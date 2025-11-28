'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import * as THREE from 'three';
import { PMTiles } from 'pmtiles';
import { latLngAltToVector3, type LatLngAltitudeLiteral } from '@/lib/geo-utils';
import { TileManager } from '@/lib/tile-manager';
import { MaterialPalette } from '@/lib/material-palette';
import type { IndoorPolygonData, WorkerResponse } from '@/workers/pmtiles-worker';

interface IndoorOverlayProps {
  visible?: boolean;
  opacity?: number;
  activeVenueId?: string | null;
  activeLevelOrdinal?: number | null;
}

const MIN_INDOOR_ZOOM = 16;

/**
 * IndoorOverlayPMTiles
 *
 * Renders indoor venue polygons (footprint/level/unit/venue) from a PMTiles
 * archive (`indoor-connected.pmtiles`) using the same WebGLOverlayView +
 * Three.js + worker + TileManager architecture as the 3D buildings overlay.
 */
export function IndoorOverlayPMTiles({
  visible = false,
  opacity = 0.8,
  activeVenueId = null,
  activeLevelOrdinal = null,
}: IndoorOverlayProps) {
  const map = useMap();
  const overlayRef = useRef<google.maps.WebGLOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const pmtilesRef = useRef<PMTiles | null>(null);

  // Architecture components
  const tileManagerRef = useRef<TileManager | null>(null);
  const materialPaletteRef = useRef<MaterialPalette | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Anchor point for coordinate transformation (set once at initialization)
  const anchorRef = useRef<LatLngAltitudeLiteral>({ lat: 22.3193, lng: 114.1694, altitude: 0 });

  // Use ref to track visibility so onDraw can access current value
  const visibleRef = useRef(visible);

  // Track filter props in refs for handleTileReady closure
  const activeVenueIdRef = useRef(activeVenueId);
  const activeLevelOrdinalRef = useRef(activeLevelOrdinal);

  // Update refs when props change
  useEffect(() => {
    activeVenueIdRef.current = activeVenueId;
    activeLevelOrdinalRef.current = activeLevelOrdinal;
  }, [activeVenueId, activeLevelOrdinal]);

  // Update ref when visible prop changes
  useEffect(() => {
    visibleRef.current = visible;
    console.log(`🏢 IndoorOverlayPMTiles visible changed to: ${visible}`);

    // Trigger redraw when visibility changes
    if (overlayRef.current) {
      overlayRef.current.requestRedraw();
    }
  }, [visible]);

  // Initialize PMTiles archive, Web Worker, and MaterialPalette
  useEffect(() => {
    const pmtilesUrl = process.env.NEXT_PUBLIC_INDOOR_CONNECTED_PMTILES_URL;
    if (!pmtilesUrl) {
      console.error('🏢 IndoorOverlay: NEXT_PUBLIC_INDOOR_CONNECTED_PMTILES_URL is not set');
      return;
    }

    console.log(`🏢 Initializing Indoor PMTiles from: ${pmtilesUrl}`);

    const pmtiles = new PMTiles(pmtilesUrl);
    pmtilesRef.current = pmtiles;

    // Verify the archive is accessible
    pmtiles.getHeader().then(header => {
      console.log('🏢 Indoor PMTiles header loaded:', {
        minZoom: header.minZoom,
        maxZoom: header.maxZoom,
        tileType: header.tileType
      });
    }).catch(error => {
      console.error('🏢 Failed to load Indoor PMTiles header:', error);
    });

    // Initialize Web Worker
    const worker = new Worker(new URL('@/workers/pmtiles-worker.ts', import.meta.url));
    workerRef.current = worker;

    // Initialize Material Palette
    const materialPalette = new MaterialPalette(opacity);
    materialPaletteRef.current = materialPalette;

    console.log('🏢 Worker and MaterialPalette initialized');

    return () => {
      // Ensure TileManager is torn down if still around
      if (tileManagerRef.current) {
        tileManagerRef.current.dispose();
        tileManagerRef.current = null;
      }

      // Terminate worker
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      // Cleanup material palette
      if (materialPaletteRef.current) {
        materialPaletteRef.current.dispose();
        materialPaletteRef.current = null;
      }

      pmtilesRef.current = null;
    };
  }, []);

  // Setup WebGL overlay (matches building overlay pattern)
  useEffect(() => {
    if (!map || !google.maps.WebGLOverlayView) {
      console.warn('🏢 IndoorOverlay: Map or WebGLOverlayView not available');
      return;
    }

    console.log('🏢 Initializing IndoorOverlayPMTiles...');

    // Create WebGL Overlay View
    const overlay = new google.maps.WebGLOverlayView();
    overlayRef.current = overlay;

    /**
     * onAdd: Called when overlay is first created
     */
    overlay.onAdd = () => {
      console.log('🏢 WebGLOverlayView onAdd');

      // Set anchor point from map center
      const center = map.getCenter();
      if (center) {
        anchorRef.current = {
          lat: center.lat(),
          lng: center.lng(),
          altitude: 0
        };
        console.log('🏢 Anchor set to:', anchorRef.current);
      }

      // Create Three.js scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Add ambient light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      // Add directional light
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.35);
      directionalLight.position.set(0.5, -1, 0.8);
      scene.add(directionalLight);

      console.log('🏢 Three.js scene created with lighting');
    };

    /**
     * onContextRestored: Called when WebGL context is available
     */
    overlay.onContextRestored = ({ gl }: { gl: WebGLRenderingContext }) => {
      console.log('🏢 WebGL context restored');

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
          maxConcurrentLoads: 4,
          maxCachedTiles: 50,
          pmtiles: pmtilesRef.current,
          worker: workerRef.current,
          onTileReady: handleTileReady,
          requestType: 'DECODE_INDOOR_TILE',
        });
        tileManagerRef.current = tileManager;
        console.log('🏢 TileManager initialized');
      }

      console.log('🏢 Three.js renderer initialized');
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
          console.warn('🏢 onDraw missing dependencies:', { scene: !!scene, renderer: !!renderer, camera: !!camera });
        }
        frameCount++;
        return;
      }

      // Check if we should render based on zoom level and visibility
      const currentZoom = map.getZoom() ?? 11;
      const shouldRender = visibleRef.current && currentZoom >= MIN_INDOOR_ZOOM;

      if (!shouldRender) {
        if (frameCount % 60 === 0) {
          if (!visibleRef.current) {
            console.log('🏢 Indoor hidden (visible=false)');
          } else {
            console.log(`🏢 Indoor hidden (zoom ${currentZoom.toFixed(1)} < ${MIN_INDOOR_ZOOM})`);
          }
        }
        frameCount++;
        return;
      }

      // Update camera projection matrix
      const anchor = anchorRef.current;
      const matrix = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });

      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

      // Log scene stats periodically
      if (frameCount % 120 === 0 && tileManager && materialPaletteRef.current) {
        const stats = tileManager.getStats();
        const memoryInfo = renderer.info.memory;
        const paletteStats = materialPaletteRef.current.getStats();
        console.log(`🏢 Render stats:`, {
          cachedTiles: stats.cacheSize,
          loading: stats.currentlyLoading,
          queueSize: stats.queueSize,
          totalLoaded: stats.tilesLoaded,
          webglGeometries: memoryInfo.geometries,
          materialColors: paletteStats.meshColors,
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
      console.warn('🏢 WebGL context lost');
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };

    /**
     * onRemove: Called when overlay is removed
     */
    overlay.onRemove = () => {
      console.log('🏢 Removing IndoorOverlayPMTiles');

      // Clear all tiles from scene and cache
      clearAllTiles();

      // Dispose TileManager
      if (tileManagerRef.current) {
        tileManagerRef.current.dispose();
        tileManagerRef.current = null;
      }

      // Dispose Three.js renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      if (sceneRef.current) {
        sceneRef.current.clear();
        sceneRef.current = null;
      }

      cameraRef.current = null;
      anchorRef.current = { lat: 22.3193, lng: 114.1694, altitude: 0 };

      setIsInitialized(false);
    };

    // Add overlay to map
    overlay.setMap(map);

    return () => {
      overlay.setMap(null);
    };
  }, [map]);

  /**
   * Handle tile ready callback from TileManager
   */
  const handleTileReady = (tileKey: string, response: WorkerResponse) => {
    if (!sceneRef.current || !materialPaletteRef.current || !tileManagerRef.current) {
      return;
    }

    if (response.type !== 'INDOOR_TILE_DECODED' || !response.indoorPolygons) {
      return;
    }

    const scene = sceneRef.current;
    const materialPalette = materialPaletteRef.current;
    const tileManager = tileManagerRef.current;

    // Filter by venue and level if specified
    const filtered = response.indoorPolygons.filter(poly => {
      const venueId = activeVenueIdRef.current;
      const levelOrdinal = activeLevelOrdinalRef.current;

      if (venueId && poly.venueId && poly.venueId !== venueId) return false;
      if (levelOrdinal !== null && levelOrdinal !== undefined && typeof poly.ordinal === 'number' && poly.ordinal !== levelOrdinal) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      // Cache empty tile so we don't re-request
      tileManager.addToCache(tileKey, new THREE.Group());
      return;
    }

    // Create tile group
    const tileGroup = createIndoorMeshes(filtered, materialPalette);
    tileGroup.name = tileKey;

    // Add to scene
    scene.add(tileGroup);

    // Add to cache
    const evictedTiles = tileManager.addToCache(tileKey, tileGroup);

    // Remove evicted tiles from scene
    evictedTiles.forEach(evictedGroup => {
      disposeTileGroup(evictedGroup, scene);
    });

    console.log(`🏢 Tile ${tileKey} ready with ${filtered.length} polygons`);

    // Request redraw
    if (overlayRef.current) {
      overlayRef.current.requestRedraw();
    }
  };

  /**
   * Load indoor tiles when map viewport changes
   */
  useEffect(() => {
    if (!map || !isInitialized || !visible || !tileManagerRef.current) {
      return;
    }

    let debounceTimer: NodeJS.Timeout | null = null;

    const handleIdle = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        loadIndoorForViewport();
        debounceTimer = null;
      }, 150);
    };

    // Load initial tiles immediately
    loadIndoorForViewport();

    // Listen to 'idle' event
    const listener = map.addListener('idle', handleIdle);

    return () => {
      listener.remove();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [map, isInitialized, visible]);

  /**
   * Update opacity when it changes
   */
  useEffect(() => {
    if (materialPaletteRef.current) {
      materialPaletteRef.current.setOpacity(opacity);
      if (overlayRef.current) {
        overlayRef.current.requestRedraw();
      }
    }
  }, [opacity]);

  /**
   * Show/hide indoor when visibility changes
   */
  useEffect(() => {
    if (!sceneRef.current) return;

    if (!visible) {
      // When hiding, clear all tiles to free memory
      clearAllTiles();
    } else {
      // When showing, trigger reload
      if (isInitialized && tileManagerRef.current) {
        loadIndoorForViewport();
      }
      // Trigger redraw
      if (overlayRef.current) {
        overlayRef.current.requestRedraw();
      }
    }
  }, [visible]);

  /**
   * Reload tiles when filter props change
   */
  useEffect(() => {
    if (!isInitialized || !visible || !tileManagerRef.current) return;

    // Clear and reload to apply new filters
    clearAllTiles();
    loadIndoorForViewport();
  }, [activeVenueId, activeLevelOrdinal, isInitialized, visible]);

  /**
   * Dispose a tile group and all its geometries
   */
  const disposeTileGroup = (tileGroup: THREE.Group, scene: THREE.Scene) => {
    scene.remove(tileGroup);

    tileGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        obj.geometry.dispose();
      }
    });
  };

  /**
   * Clear all loaded tiles and remove from scene
   */
  const clearAllTiles = () => {
    if (!sceneRef.current || !tileManagerRef.current) return;

    const scene = sceneRef.current;
    const tileManager = tileManagerRef.current;

    const allTiles = tileManager.clearAll();
    allTiles.forEach(tileGroup => {
      disposeTileGroup(tileGroup, scene);
    });

    console.log('🏢 Cleared all indoor tiles');
  };

  /**
   * Get viewport bounds for tile loading
   */
  const getViewportBounds = (): google.maps.LatLngBounds | null => {
    if (!map) return null;
    return map.getBounds() || null;
  };

  /**
   * Load indoor tiles for the current viewport
   */
  const loadIndoorForViewport = () => {
    if (!map || !tileManagerRef.current || !sceneRef.current) return;

    const zoom = map.getZoom() ?? 11;
    const center = map.getCenter();

    if (!center) return;

    // Clear all tiles if zoom is below threshold
    if (zoom < MIN_INDOOR_ZOOM) {
      clearAllTiles();
      return;
    }

    // Determine which zoom level tiles to load (clamp to PMTiles range 15-18)
    const tileZoom = Math.min(Math.max(Math.floor(zoom), 15), 18);

    const bounds = getViewportBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    // Calculate tile range for current viewport
    const tiles = getTilesInBounds(sw.lat(), sw.lng(), ne.lat(), ne.lng(), tileZoom);

    // Calculate center tile for distance-based priority
    const centerLat = center.lat();
    const centerLng = center.lng();
    const centerTile = latLngToTile(centerLat, centerLng, tileZoom);

    console.log(`🏢 Viewport: zoom=${zoom.toFixed(1)}, tileZoom=${tileZoom}, tiles=${tiles.length}`);

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
      disposeTileGroup(tileGroup, scene);
    });

    // Request tiles with distance-based priority from center
    tileManager.requestTiles(tiles.map(tile => {
      const dx = tile.x - centerTile.x;
      const dy = tile.y - centerTile.y;
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
   * Create Three.js meshes from indoor polygon data
   */
  const createIndoorMeshes = (
    polygons: IndoorPolygonData[],
    materialPalette: MaterialPalette
  ): THREE.Group => {
    const tileGroup = new THREE.Group();
    const anchor = anchorRef.current;

    for (const poly of polygons) {
      try {
        // Convert all polygon coordinates to anchor-relative 3D positions
        // Note: altitude: 0 here, we set Z position on the group
        const absolutePoints: THREE.Vector3[] = [];
        poly.coordinates.forEach(([lng, lat]) => {
          const point = latLngAltToVector3(
            { lat, lng, altitude: 0 },
            anchor
          );
          absolutePoints.push(point);
        });

        if (absolutePoints.length < 3) continue;

        // Calculate center point in 3D space
        let centerX = 0;
        let centerY = 0;
        absolutePoints.forEach((pt) => {
          centerX += pt.x;
          centerY += pt.y;
        });
        centerX /= absolutePoints.length;
        centerY /= absolutePoints.length;

        // Create 2D shape from polygon in local coordinates
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
          continue;
        }

        // Extrude to 3D
        const extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
          depth: poly.height,
          bevelEnabled: false
        });

        // Get reusable material from palette
        const material = materialPalette.getMaterial(poly.color || '#94a3b8');

        const mesh = new THREE.Mesh(extrudeGeometry, material);

        // Create a group for this polygon
        const polyGroup = new THREE.Group();
        polyGroup.add(mesh);

        // Position the group at the polygon's centroid, with Z = altitude
        polyGroup.position.set(centerX, centerY, poly.altitude);

        tileGroup.add(polyGroup);
      } catch (error) {
        console.error('Failed to create indoor mesh:', error);
      }
    }

    return tileGroup;
  };

  // This component doesn't render anything to the DOM
  return null;
}
