'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import * as THREE from 'three';
import { latLngAltToVector3, type LatLngAltitudeLiteral } from '@/lib/geo-utils';

interface BuildingFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    OBJECTID: number;
    BUILDINGSTRUCTUREID: number;
    CATEGORY: string;
    height_m: number;
    color: string;
    [key: string]: any;
  };
}

interface TileData {
  type: 'FeatureCollection';
  tile: { z: number; x: number; y: number };
  count: number;
  features: BuildingFeature[];
}

interface BuildingOverlayProps {
  visible?: boolean;
  opacity?: number;
}

/**
 * BuildingOverlay component
 *
 * Renders 3D building extrusions on Google Maps using WebGLOverlayView and Three.js.
 * Loads building data from tiled GeoJSON files based on current map viewport.
 */
export function BuildingOverlay({ visible = true, opacity = 0.8 }: BuildingOverlayProps) {
  const map = useMap();
  const overlayRef = useRef<google.maps.WebGLOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const buildingMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const loadedTilesRef = useRef<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Anchor point for coordinate transformation (fixed at map center on init)
  const anchorRef = useRef<LatLngAltitudeLiteral>({ lat: 22.3193, lng: 114.1694, altitude: 0 });

  // Minimum zoom level to show buildings
  const MIN_BUILDING_ZOOM = 17;

  // Use ref to track visibility so onDraw can access current value
  const visibleRef = useRef(visible);

  // Update ref when visible prop changes
  useEffect(() => {
    visibleRef.current = visible;
    console.log(`🔍 BuildingOverlay visible changed to: ${visible}`);

    // Trigger redraw when visibility changes
    if (overlayRef.current) {
      overlayRef.current.requestRedraw();
    }
  }, [visible]);

  useEffect(() => {
    if (!map || !google.maps.WebGLOverlayView) {
      console.warn('Map or WebGLOverlayView not available');
      return;
    }

    console.log('🏗️ Initializing BuildingOverlay...');

    // Create WebGL Overlay View
    const overlay = new google.maps.WebGLOverlayView();
    overlayRef.current = overlay;

    /**
     * onAdd: Called when overlay is first created
     */
    overlay.onAdd = () => {
      console.log('✅ WebGLOverlayView onAdd');

      // Set anchor point from map center (this stays fixed for all transformations)
      const center = map.getCenter();
      if (center) {
        anchorRef.current = {
          lat: center.lat(),
          lng: center.lng(),
          altitude: 0
        };
        console.log('🎯 Anchor set to:', anchorRef.current);
      }

      // Create Three.js scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Add ambient light (soft global illumination)
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      // Add directional light (sun-like light for depth)
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
      directionalLight.position.set(0.5, -1, 0.8);
      scene.add(directionalLight);

      console.log('✅ Three.js scene created with lighting');
    };

    /**
     * onContextRestored: Called when WebGL context is available
     */
    overlay.onContextRestored = ({ gl }: { gl: WebGLRenderingContext }) => {
      console.log('✅ WebGL context restored');

      // Create Three.js renderer using Google Maps' WebGL context
      const renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas,
        context: gl,
        ...gl.getContextAttributes(),
      });

      renderer.autoClear = false;
      rendererRef.current = renderer;

      // Create camera
      const camera = new THREE.Camera();
      cameraRef.current = camera;

      console.log('✅ Three.js renderer initialized');
      setIsInitialized(true);
    };

    /**
     * onDraw: Called every frame
     */
    let frameCount = 0;
    overlay.onDraw = ({ gl, transformer }: any) => {
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      const camera = cameraRef.current;

      if (!scene || !renderer || !camera) {
        if (frameCount % 60 === 0) {
          console.warn('⚠️ onDraw missing dependencies:', { scene: !!scene, renderer: !!renderer, camera: !!camera });
        }
        frameCount++;
        return;
      }

      // Check if we should render buildings based on zoom level
      const currentZoom = map.getZoom() ?? 11;
      const shouldRenderBuildings = visibleRef.current && currentZoom >= MIN_BUILDING_ZOOM;

      if (!shouldRenderBuildings) {
        if (frameCount % 60 === 0) {
          if (!visibleRef.current) {
            console.log('👁️ Buildings hidden (visible=false)');
          } else {
            console.log(`👁️ Buildings hidden (zoom ${currentZoom.toFixed(1)} < ${MIN_BUILDING_ZOOM})`);
          }
        }
        frameCount++;
        return;
      }

      // Update camera projection matrix from Google Maps using the ANCHOR point
      // This is critical - the camera must use the same anchor as the building positions
      const anchor = anchorRef.current;
      const matrix = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });

      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

      // Buildings are already positioned relative to anchor in their local coordinates
      // We don't need to transform them individually - they're already in the correct
      // anchor-relative coordinate space
      let buildingCount = 0;
      buildingMeshesRef.current.forEach((tileGroup) => {
        buildingCount += tileGroup.children.length;
      });

      // Log every 60 frames (~1 second at 60fps)
      if (frameCount % 60 === 0) {
        console.log(`🎨 Rendering: scene.children=${scene.children.length}, tiles=${buildingMeshesRef.current.size}, buildings=${buildingCount}, visible=${visibleRef.current}`);
      }
      frameCount++;

      // Render scene
      renderer.render(scene, camera);

      // CRITICAL: Reset GL state to prevent conflicts with Google Maps
      renderer.resetState();
    };

    /**
     * onContextLost: Called when WebGL context is lost
     */
    overlay.onContextLost = () => {
      console.warn('⚠️ WebGL context lost');
      // Clean up renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };

    /**
     * onRemove: Called when overlay is removed
     */
    overlay.onRemove = () => {
      console.log('🗑️ Removing BuildingOverlay');
      // Clean up resources properly
      clearAllTiles();
      setIsInitialized(false);
    };

    // Add overlay to map
    overlay.setMap(map);

    return () => {
      // Cleanup on unmount
      overlay.setMap(null);
    };
  }, [map]);

  /**
   * Load buildings when map viewport changes
   */
  useEffect(() => {
    if (!map || !isInitialized || !visible) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const handleViewportChange = () => {
      // Debounce: wait 300ms after map stops moving before loading tiles
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadBuildingsForViewport();
      }, 300);
    };

    // Load initial buildings immediately
    loadBuildingsForViewport();

    // Listen for map events
    const listeners = [
      map.addListener('idle', handleViewportChange), // Use 'idle' instead of 'bounds_changed'
      map.addListener('zoom_changed', handleViewportChange),
    ];

    return () => {
      clearTimeout(timeoutId);
      listeners.forEach(listener => listener.remove());
    };
  }, [map, isInitialized, visible]);

  /**
   * Update opacity when it changes
   */
  useEffect(() => {
    if (!sceneRef.current) return;

    buildingMeshesRef.current.forEach(group => {
      group.children.forEach(mesh => {
        if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.Material) {
          mesh.material.opacity = opacity;
          mesh.material.transparent = opacity < 1;
        }
      });
    });
  }, [opacity]);

  /**
   * Show/hide buildings when visibility changes
   * Optionally clear tiles when hiding to save memory
   */
  useEffect(() => {
    if (!sceneRef.current) return;

    if (!visible) {
      // When hiding buildings, clear all tiles to free memory
      clearAllTiles();
    } else {
      // When showing buildings, trigger redraw
      if (overlayRef.current) {
        overlayRef.current.requestRedraw();
      }
    }
  }, [visible]);

  /**
   * Clear all loaded tiles and remove from scene
   */
  const clearAllTiles = () => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    // Remove all tile groups from scene
    buildingMeshesRef.current.forEach((tileGroup) => {
      scene.remove(tileGroup);

      // Dispose geometries and materials to free memory
      tileGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });

    // Clear the maps
    buildingMeshesRef.current.clear();
    loadedTilesRef.current.clear();

    console.log('🗑️ Cleared all building tiles');
  };

  /**
   * Load buildings for the current viewport
   */
  const loadBuildingsForViewport = async () => {
    if (!map || !sceneRef.current) return;

    const zoom = map.getZoom() ?? 11;
    const bounds = map.getBounds();

    if (!bounds) return;

    // Clear all tiles if zoom is below threshold
    if (zoom < MIN_BUILDING_ZOOM) {
      if (buildingMeshesRef.current.size > 0) {
        console.log(`🔄 Zoom ${zoom.toFixed(1)} below threshold, clearing tiles...`);
        clearAllTiles();
      }
      return;
    }

    // Determine which zoom level tiles to load
    const tileZoom = Math.min(Math.floor(zoom), 18);

    // Get viewport bounds
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    // Calculate tile range for current viewport
    const tiles = getTilesInBounds(sw.lat(), sw.lng(), ne.lat(), ne.lng(), tileZoom);

    // Filter out already loaded tiles
    const tilesToLoad = tiles.filter(tile => {
      const tileKey = `${tile.z}/${tile.x}/${tile.y}`;
      return !loadedTilesRef.current.has(tileKey);
    });

    console.log(`📍 Viewport: zoom=${zoom.toFixed(1)}, tileZoom=${tileZoom}, total=${tiles.length}, toLoad=${tilesToLoad.length}`);

    // Limit to 20 tiles per load to prevent overwhelming the server
    const MAX_TILES_PER_LOAD = 20;
    const limitedTiles = tilesToLoad.slice(0, MAX_TILES_PER_LOAD);

    if (limitedTiles.length > 0) {
      console.log(`🔄 Loading ${limitedTiles.length} new tiles...`);
    }

    // Load tiles in parallel (but limited)
    await Promise.all(limitedTiles.map(tile => loadTile(tile.z, tile.x, tile.y)));
  };

  /**
   * Get all tiles that intersect with the given bounds
   */
  const getTilesInBounds = (
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    zoom: number
  ): Array<{ z: number; x: number; y: number }> => {
    const tiles: Array<{ z: number; x: number; y: number }> = [];

    const minTile = latLngToTile(maxLat, minLng, zoom);
    const maxTile = latLngToTile(minLat, maxLng, zoom);

    for (let x = minTile.x; x <= maxTile.x; x++) {
      for (let y = minTile.y; y <= maxTile.y; y++) {
        tiles.push({ z: zoom, x, y });
      }
    }

    return tiles;
  };

  /**
   * Convert lat/lng to tile coordinates
   */
  const latLngToTile = (lat: number, lng: number, zoom: number): { x: number; y: number } => {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return { x, y };
  };

  /**
   * Load a single tile
   */
  const loadTile = async (z: number, x: number, y: number) => {
    const tileKey = `${z}/${x}/${y}`;

    // Skip if already loaded or currently loading
    if (loadedTilesRef.current.has(tileKey)) {
      return;
    }

    // Mark as loading immediately to prevent duplicate requests
    loadedTilesRef.current.add(tileKey);

    try {
      const response = await fetch(`/buildings/tiles/${tileKey}.json`);

      if (!response.ok) {
        // Tile doesn't exist (no buildings in this tile)
        // Don't remove from loaded set - we don't want to keep retrying 404s
        return;
      }

      const tileData: TileData = await response.json();

      // Create building meshes for this tile
      createBuildingsForTile(tileData);

      console.log(`✅ Loaded tile ${tileKey} (${tileData.count} buildings)`);
    } catch (error) {
      // Only log actual errors, not 404s
      if (error instanceof Error && !error.message.includes('404')) {
        console.error(`Failed to load tile ${tileKey}:`, error);
      }
      // Keep in loaded set to prevent retries
    }
  };

  /**
   * Create Three.js meshes for buildings in a tile
   */
  const createBuildingsForTile = (tileData: TileData) => {
    if (!sceneRef.current || !overlayRef.current) return;

    const scene = sceneRef.current;
    const overlay = overlayRef.current;
    const tileKey = `${tileData.tile.z}/${tileData.tile.x}/${tileData.tile.y}`;

    // Create a group for this tile
    const tileGroup = new THREE.Group();
    tileGroup.name = tileKey;

    let meshCount = 0;
    for (const feature of tileData.features) {
      try {
        const mesh = createBuildingMesh(feature, overlay);
        if (mesh) {
          tileGroup.add(mesh);
          meshCount++;
        }
      } catch (error) {
        console.error(`Failed to create mesh for building ${feature.properties.OBJECTID}:`, error);
      }
    }

    console.log(`🏗️ Created ${meshCount} meshes for tile ${tileKey}, scene children: ${scene.children.length}`);

    // Add tile group to scene
    scene.add(tileGroup);
    buildingMeshesRef.current.set(tileKey, tileGroup);
  };

  /**
   * Create a Three.js mesh for a single building
   *
   * Uses WebMercator projection with anchor-relative coordinates.
   * This matches the reference implementation's approach.
   */
  const createBuildingMesh = (feature: BuildingFeature, overlay: google.maps.WebGLOverlayView): THREE.Object3D | null => {
    const { geometry, properties } = feature;
    const height = properties.height_m;
    const color = properties.color;

    // Get polygon coordinates (handle both Polygon and MultiPolygon)
    let polygons: number[][][][] = [];

    if (geometry.type === 'Polygon') {
      polygons = [geometry.coordinates as number[][][]];
    } else if (geometry.type === 'MultiPolygon') {
      polygons = geometry.coordinates as number[][][][];
    }

    // For now, only handle the first polygon (outer ring)
    if (polygons.length === 0 || polygons[0].length === 0) {
      return null;
    }

    const outerRing = polygons[0][0];

    if (outerRing.length < 3) {
      return null; // Need at least 3 points for a polygon
    }

    // Calculate centroid for positioning
    let centerLat = 0;
    let centerLng = 0;
    outerRing.forEach(([lng, lat]) => {
      centerLng += lng;
      centerLat += lat;
    });
    centerLat /= outerRing.length;
    centerLng /= outerRing.length;

    // Get anchor point
    const anchor = anchorRef.current;

    // Convert all polygon coordinates to anchor-relative 3D positions using WebMercator
    const absolutePoints: THREE.Vector3[] = [];
    outerRing.forEach(([lng, lat]) => {
      const point = latLngAltToVector3(
        { lat, lng, altitude: 0 },
        anchor
      );
      absolutePoints.push(point);
    });

    // Calculate center point in 3D space
    let centerX = 0;
    let centerY = 0;
    absolutePoints.forEach((pt) => {
      centerX += pt.x;
      centerY += pt.y;
    });
    centerX /= absolutePoints.length;
    centerY /= absolutePoints.length;

    // Create 2D shape from polygon in local coordinates (centered at origin)
    const shape = new THREE.Shape();
    absolutePoints.forEach((pt, index) => {
      const localX = pt.x - centerX;
      const localY = pt.y - centerY;

      if (index === 0) {
        shape.moveTo(localX, localY);
      } else {
        shape.lineTo(localX, localY);
      }
    });
    shape.closePath();

    // Validate shape has area
    const area = THREE.ShapeUtils.area(shape.getPoints());
    if (Math.abs(area) < 0.1) {
      // Shape too small or degenerate, skip it
      return null;
    }

    // Extrude to 3D with try-catch to handle geometry errors
    let extrudeGeometry: THREE.ExtrudeGeometry;
    try {
      extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false
      });
    } catch (error) {
      // Skip buildings that cause geometry errors
      console.warn(`Failed to extrude building at ${centerLat}, ${centerLng}:`, error);
      return null;
    }

    // Create material with category color
    const material = new THREE.MeshLambertMaterial({
      color: color,
      opacity: opacity,
      transparent: opacity < 1,
    });

    const mesh = new THREE.Mesh(extrudeGeometry, material);

    // Create a group for this building
    const buildingGroup = new THREE.Group();
    buildingGroup.add(mesh);

    // Position the group at the building's centroid (in anchor-relative coordinates)
    // ExtrudeGeometry extrudes along Z-axis, which matches Google Maps' altitude axis
    buildingGroup.position.set(centerX, centerY, 0);

    return buildingGroup;
  };

  // This component doesn't render anything to the DOM
  // All rendering happens through WebGLOverlayView
  return null;
}
