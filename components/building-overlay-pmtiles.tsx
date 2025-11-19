'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import * as THREE from 'three';
import { PMTiles } from 'pmtiles';
import { latLngAltToVector3, type LatLngAltitudeLiteral } from '@/lib/geo-utils';
import { TileManager } from '@/lib/tile-manager';
import { MaterialPalette } from '@/lib/material-palette';
import type { BuildingData } from '@/workers/pmtiles-worker';

interface BuildingOverlayProps {
  visible?: boolean;
  opacity?: number;
}

/**
 * BuildingOverlayPMTiles component
 *
 * Renders 3D building extrusions on Google Maps using WebGLOverlayView and Three.js.
 * Loads building data from a PMTiles archive instead of individual GeoJSON tiles.
 */
export function BuildingOverlayPMTiles({ visible = true, opacity = 0.8 }: BuildingOverlayProps) {
  const map = useMap();
  const overlayRef = useRef<google.maps.WebGLOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const pmtilesRef = useRef<PMTiles | null>(null);

  // New architecture components
  const tileManagerRef = useRef<TileManager | null>(null);
  const materialPaletteRef = useRef<MaterialPalette | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Anchor point for coordinate transformation (set once at initialization)
  const anchorRef = useRef<LatLngAltitudeLiteral>({ lat: 22.3193, lng: 114.1694, altitude: 0 });

  // Minimum zoom level to show buildings
  const MIN_BUILDING_ZOOM = 16; // Start showing buildings at z16

  // Use ref to track visibility so onDraw can access current value
  const visibleRef = useRef(visible);

  // Update ref when visible prop changes
  useEffect(() => {
    visibleRef.current = visible;
    console.log(`🔍 BuildingOverlayPMTiles visible changed to: ${visible}`);

    // Trigger redraw when visibility changes
    if (overlayRef.current) {
      overlayRef.current.requestRedraw();
    }
  }, [visible]);

  // Initialize PMTiles archive, Web Worker, and TileManager
  useEffect(() => {
    // Use Cloudflare Worker for edge caching (not raw R2)
    const pmtilesCdnUrl = process.env.NEXT_PUBLIC_PMTILES_CDN_URL || 'https://pmtiles-cors-proxy.mark-737.workers.dev';
    const pmtilesUrl = `${pmtilesCdnUrl}/buildings.pmtiles`;

    console.log(`📦 Initializing PMTiles from: ${pmtilesUrl}`);

    const pmtiles = new PMTiles(pmtilesUrl);
    pmtilesRef.current = pmtiles;

    // Verify the archive is accessible
    pmtiles.getHeader().then(header => {
      console.log('✅ PMTiles header loaded:', {
        minZoom: header.minZoom,
        maxZoom: header.maxZoom,
        tileType: header.tileType
      });
    }).catch(error => {
      console.error('❌ Failed to load PMTiles header:', error);
    });

    // Initialize Web Worker
    const worker = new Worker(new URL('@/workers/pmtiles-worker.ts', import.meta.url));
    workerRef.current = worker;

    // Initialize Material Palette
    const materialPalette = new MaterialPalette(opacity);
    materialPaletteRef.current = materialPalette;

    console.log('✅ Worker and MaterialPalette initialized');

    return () => {
      // Cleanup worker
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      // Cleanup material palette
      if (materialPaletteRef.current) {
        materialPaletteRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!map || !google.maps.WebGLOverlayView) {
      console.warn('Map or WebGLOverlayView not available');
      return;
    }

    console.log('🏗️ Initializing BuildingOverlayPMTiles...');

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

      // Initialize TileManager (now that we have pmtiles and worker)
      if (pmtilesRef.current && workerRef.current && sceneRef.current) {
        const tileManager = new TileManager({
          maxConcurrentLoads: 4, // Load 4 tiles at a time for faster loading
          maxCachedTiles: 50,     // Large cache since we aggressively prune out-of-viewport tiles
          pmtiles: pmtilesRef.current,
          worker: workerRef.current,
          onTileReady: handleTileReady,
        });
        tileManagerRef.current = tileManager;
        console.log('✅ TileManager initialized');
      }

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
      const tileManager = tileManagerRef.current;

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

      // Update camera projection matrix using the SAME anchor as geometry
      // This keeps both geometry and camera in the same coordinate frame
      const anchor = anchorRef.current;
      const matrix = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });

      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

      // Log scene stats periodically
      if (frameCount % 120 === 0 && tileManager) {
        const stats = tileManager.getStats();
        console.log(`🎨 Render stats:`, {
          cachedTiles: stats.cacheSize,
          loading: stats.currentlyLoading,
          queueSize: stats.queueSize,
          totalLoaded: stats.tilesLoaded,
          totalEvicted: stats.tilesEvicted,
        });
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
      console.log('🗑️ Removing BuildingOverlayPMTiles');
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
   * Handle tile ready callback from TileManager
   */
  const handleTileReady = (tileKey: string, buildings: BuildingData[]) => {
    if (!sceneRef.current || !materialPaletteRef.current || !tileManagerRef.current) {
      return;
    }

    const scene = sceneRef.current;
    const materialPalette = materialPaletteRef.current;
    const tileManager = tileManagerRef.current;

    // Parse tile coordinates from tileKey
    const [z, x, y] = tileKey.split('/').map(Number);

    // Create tile group
    const tileGroup = createBuildingsFromWorkerData(buildings, materialPalette);
    tileGroup.name = tileKey;

    // Add to scene
    scene.add(tileGroup);

    // Add to cache - this may evict LRU tiles if cache is full
    const evictedTiles = tileManager.addToCache(tileKey, tileGroup);

    // Remove evicted tiles from scene and dispose their geometries
    evictedTiles.forEach(evictedGroup => {
      scene.remove(evictedGroup);
      // Dispose geometries (materials are shared, so don't dispose them)
      evictedGroup.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    });

    console.log(`✅ Tile ${tileKey} ready with ${buildings.length} buildings`);

    // Request redraw
    if (overlayRef.current) {
      overlayRef.current.requestRedraw();
    }
  };

  /**
   * Load buildings when map viewport changes
   */
  useEffect(() => {
    if (!map || !isInitialized || !visible || !tileManagerRef.current) {
      return;
    }

    const handleIdle = () => {
      // Map has finished moving/zooming - load tiles for current viewport
      loadBuildingsForViewport();
    };

    // Load initial buildings immediately
    loadBuildingsForViewport();

    // Listen only to 'idle' event - fires when map finishes moving/zooming
    // This prevents loading tiles for intermediate viewport states
    const listener = map.addListener('idle', handleIdle);

    return () => {
      listener.remove();
    };
  }, [map, isInitialized, visible]);

  /**
   * Update opacity when it changes
   */
  useEffect(() => {
    if (materialPaletteRef.current) {
      materialPaletteRef.current.setOpacity(opacity);
      // Request redraw to show updated opacity
      if (overlayRef.current) {
        overlayRef.current.requestRedraw();
      }
    }
  }, [opacity]);

  /**
   * Show/hide buildings when visibility changes
   */
  useEffect(() => {
    if (!sceneRef.current) return;

    if (!visible) {
      // When hiding buildings, clear all tiles to free memory
      clearAllTiles();
    } else {
      // When showing buildings, trigger reload
      if (isInitialized && tileManagerRef.current) {
        loadBuildingsForViewport();
      }
      // Trigger redraw
      if (overlayRef.current) {
        overlayRef.current.requestRedraw();
      }
    }
  }, [visible]);

  /**
   * Clear all loaded tiles and remove from scene
   */
  const clearAllTiles = () => {
    if (!sceneRef.current || !tileManagerRef.current) return;

    const scene = sceneRef.current;
    const tileManager = tileManagerRef.current;

    // Get all tiles and remove from scene
    const allTiles = tileManager.clearAll();
    allTiles.forEach(tileGroup => {
      scene.remove(tileGroup);

      // Dispose geometries (materials are shared, so don't dispose them)
      tileGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    });

    console.log('🗑️ Cleared all building tiles');
  };


  /**
   * Get viewport bounds for tile loading
   * Uses actual viewport without buffer since we prune aggressively
   */
  const getViewportBounds = (): google.maps.LatLngBounds | null => {
    if (!map) return null;

    // Use actual viewport bounds without buffer
    // Viewport-aware pruning handles cleanup when panning
    return map.getBounds() || null;
  };

  /**
   * Load buildings for the current viewport
   */
  const loadBuildingsForViewport = () => {
    if (!map || !tileManagerRef.current || !sceneRef.current) return;

    const zoom = map.getZoom() ?? 11;
    const center = map.getCenter();
    const tilt = map.getTilt() ?? 0;

    if (!center) return;

    // Clear all tiles if zoom is below threshold
    if (zoom < MIN_BUILDING_ZOOM) {
      clearAllTiles();
      return;
    }

    // Determine which zoom level tiles to load (clamp to PMTiles range 15-18)
    const tileZoom = Math.min(Math.max(Math.floor(zoom), 15), 18);

    // Get viewport bounds for tile loading
    const bounds = getViewportBounds();
    if (!bounds) return;

    // Get viewport bounds
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    // Calculate tile range for current viewport
    const tiles = getTilesInBounds(sw.lat(), sw.lng(), ne.lat(), ne.lng(), tileZoom);

    // Calculate center tile for distance-based priority
    const centerLat = center.lat();
    const centerLng = center.lng();
    const centerTile = latLngToTile(centerLat, centerLng, tileZoom);

    console.log(`📍 Viewport: zoom=${zoom.toFixed(1)}, tileZoom=${tileZoom}, tilt=${tilt.toFixed(1)}°, tiles=${tiles.length}`);

    // Build set of required tile keys
    const requiredTileKeys = new Set<string>();
    tiles.forEach(tile => {
      requiredTileKeys.add(`${tile.z}/${tile.x}/${tile.y}`);
    });

    // Prune cached tiles that are outside current viewport
    const tileManager = tileManagerRef.current;
    const scene = sceneRef.current;
    const prunedTiles = tileManager.pruneToBounds(requiredTileKeys);
    prunedTiles.forEach(tileGroup => {
      scene.remove(tileGroup);
      // Dispose geometries (materials are shared)
      tileGroup.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    });

    // Request tiles with simple distance-based priority from center
    tileManager.requestTiles(tiles.map(tile => {
      const dx = tile.x - centerTile.x;
      const dy = tile.y - centerTile.y;

      // Simple distance-based priority (lower = higher priority)
      const priority = dx * dx + dy * dy;

      return {
        z: tile.z,
        x: tile.x,
        y: tile.y,
        priority,
      };
    }));
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
   * Create Three.js meshes from worker-processed building data
   */
  const createBuildingsFromWorkerData = (buildings: BuildingData[], materialPalette: MaterialPalette): THREE.Group => {
    const tileGroup = new THREE.Group();
    const anchor = anchorRef.current;

    for (const building of buildings) {
      try {
        const mesh = createBuildingMesh(building, anchor, materialPalette);
        if (mesh) {
          tileGroup.add(mesh);
        }
      } catch (error) {
        console.error(`Failed to create mesh for building:`, error);
      }
    }

    return tileGroup;
  };

  /**
   * Create a single building mesh from processed data
   */
  const createBuildingMesh = (
    building: BuildingData,
    anchor: LatLngAltitudeLiteral,
    materialPalette: MaterialPalette
  ): THREE.Object3D | null => {
    const { coordinates, height, color, centerLat, centerLng } = building;

    // Convert all polygon coordinates to anchor-relative 3D positions
    const absolutePoints: THREE.Vector3[] = [];
    coordinates.forEach(([lng, lat]) => {
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
      return null;
    }

    // Extrude to 3D
    let extrudeGeometry: THREE.ExtrudeGeometry;
    try {
      extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false
      });
    } catch (error) {
      console.warn(`Failed to extrude building at ${centerLat}, ${centerLng}:`, error);
      return null;
    }

    // Get reusable material from palette
    const material = materialPalette.getMaterial(color);

    const mesh = new THREE.Mesh(extrudeGeometry, material);

    // Create a group for this building
    const buildingGroup = new THREE.Group();
    buildingGroup.add(mesh);

    // Position the group at the building's centroid (in anchor-relative coordinates)
    buildingGroup.position.set(centerX, centerY, 0);

    return buildingGroup;
  };

  // This component doesn't render anything to the DOM
  // All rendering happens through WebGLOverlayView
  return null;
}
