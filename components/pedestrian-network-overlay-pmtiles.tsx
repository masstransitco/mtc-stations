'use client';

/**
 * PedestrianNetworkOverlayPMTiles Component
 *
 * Renders 3D pedestrian network (walkways, footbridges, underground passages)
 * on Google Maps using WebGLOverlayView and Three.js.
 *
 * Based on BuildingOverlayPMTiles pattern but renders LineStrings as tubes/lines.
 */

import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import * as THREE from 'three';
import { PMTiles } from 'pmtiles';
import { latLngAltToVector3 } from '@/lib/geo-utils';
import { TileManager } from '@/lib/tile-manager';
import { MaterialPalette } from '@/lib/material-palette';
import type { PedestrianLineData, WorkerResponse } from '@/workers/pmtiles-worker';

interface PedestrianNetworkOverlayProps {
  visible?: boolean;
  opacity?: number;
}

// Minimum zoom level to show pedestrian network
const MIN_PEDESTRIAN_ZOOM = 16;

export function PedestrianNetworkOverlayPMTiles({
  visible = true,
  opacity = 0.9,
}: PedestrianNetworkOverlayProps) {
  const map = useMap();
  const overlayRef = useRef<google.maps.WebGLOverlayView | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const visibleRef = useRef(visible);

  // Refs for WebGL resources
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const anchorRef = useRef<{ lat: number; lng: number; altitude: number } | null>(null);
  const tileManagerRef = useRef<TileManager | null>(null);
  const materialPaletteRef = useRef<MaterialPalette | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pmtilesRef = useRef<PMTiles | null>(null);

  // Track which tiles are currently in the scene
  const tileCacheRef = useRef<Map<string, THREE.Group>>(new Map());

  // Performance tracking
  const frameCountRef = useRef(0);
  const lastStatsLogRef = useRef(0);
  const lastViewportLogRef = useRef(0);

  // Keep visibility ref in sync
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Initialize PMTiles and Worker
  useEffect(() => {
    const pmtilesUrl = process.env.NEXT_PUBLIC_PEDESTRIAN_PMTILES_URL;
    if (!pmtilesUrl) {
      console.error('PedestrianNetwork: NEXT_PUBLIC_PEDESTRIAN_PMTILES_URL not configured');
      return;
    }

    console.log('PedestrianNetwork: Initializing with PMTiles URL:', pmtilesUrl);

    // Initialize PMTiles archive
    const pmtiles = new PMTiles(pmtilesUrl);
    pmtilesRef.current = pmtiles;

    // Spawn Web Worker for tile processing
    const worker = new Worker(new URL('@/workers/pmtiles-worker.ts', import.meta.url));
    workerRef.current = worker;
    console.log('PedestrianNetwork: Worker spawned');

    // Create material palette
    const materialPalette = new MaterialPalette(opacity);
    materialPaletteRef.current = materialPalette;

    return () => {
      console.log('PedestrianNetwork: Cleanup - terminating worker');
      worker.terminate();
      workerRef.current = null;
      pmtilesRef.current = null;
      materialPaletteRef.current = null;
    };
  }, []); // Only initialize once, not on opacity changes!

  // Setup WebGL Overlay
  useEffect(() => {
    if (!map || overlayRef.current) return;

    console.log('PedestrianNetwork: Creating WebGL overlay');

    const webglOverlay = new google.maps.WebGLOverlayView();

    webglOverlay.onAdd = () => {
      console.log('PedestrianNetwork: Overlay onAdd called');

      // Create Three.js scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
      directionalLight.position.set(0.5, 1, 0.5);
      scene.add(directionalLight);

      // Set anchor to map center (used for coordinate conversion)
      const center = map.getCenter();
      if (center) {
        anchorRef.current = {
          lat: center.lat(),
          lng: center.lng(),
          altitude: 0,
        };
        console.log('PedestrianNetwork: Anchor set to', anchorRef.current);
      }
    };

    webglOverlay.onContextRestored = ({ gl }) => {
      console.log('PedestrianNetwork: WebGL context restored');

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

      // Initialize TileManager
      const pmtiles = pmtilesRef.current;
      const worker = workerRef.current;

      if (pmtiles && worker) {
        console.log('PedestrianNetwork: Initializing TileManager');
        const tileManager = new TileManager({
          maxConcurrentLoads: 4,
          maxCachedTiles: 50,
          pmtiles,
          worker,
          onTileReady: handleTileReady,
          requestType: 'DECODE_PEDESTRIAN_TILE', // Use pedestrian decode
        });
        tileManagerRef.current = tileManager;

        // Mark as initialized
        setIsInitialized(true);
        console.log('PedestrianNetwork: Initialization complete, loading tiles');

        // Load initial tiles
        loadPedestrianForViewport();
      }
    };

    webglOverlay.onDraw = ({ gl, transformer }) => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const anchor = anchorRef.current;

      if (!scene || !camera || !renderer || !anchor) return;

      // Check zoom level and visibility before rendering
      const currentZoom = map.getZoom() ?? 11;
      const shouldRenderPedestrian = visibleRef.current && currentZoom >= MIN_PEDESTRIAN_ZOOM;

      if (!shouldRenderPedestrian) {
        // Log occasionally to avoid console spam
        if (frameCountRef.current % 60 === 0) {
          if (!visibleRef.current) {
            console.log('👁️ Pedestrian network hidden (visible=false)');
          } else {
            console.log(`👁️ Pedestrian network hidden (zoom ${currentZoom.toFixed(1)} < ${MIN_PEDESTRIAN_ZOOM})`);
          }
        }
        frameCountRef.current++;
        return;
      }

      // Update camera matrix using fixed anchor
      const matrix = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

      // Render scene
      renderer.render(scene, camera);
      renderer.resetState(); // Critical: prevent conflicts with Google Maps

      // Periodic stats logging (every 120 frames)
      frameCountRef.current++;
      if (frameCountRef.current - lastStatsLogRef.current >= 120) {
        const tileManager = tileManagerRef.current;
        if (tileManager) {
          const stats = tileManager.getStats();
          console.log('📊 Pedestrian Network Stats:', {
            cachedTiles: stats.cacheSize,
            loading: stats.currentlyLoading,
            queueSize: stats.queueSize,
            totalLoaded: stats.tilesLoaded,
            totalEvicted: stats.tilesEvicted
          });
        }
        lastStatsLogRef.current = frameCountRef.current;
      }
    };

    webglOverlay.onContextLost = () => {
      console.log('PedestrianNetwork: WebGL context lost');
      rendererRef.current = null;
      cameraRef.current = null;
      setIsInitialized(false);
    };

    webglOverlay.onRemove = () => {
      console.log('PedestrianNetwork: Overlay removed');
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      setIsInitialized(false);
    };

    console.log('PedestrianNetwork: Attaching overlay to map');
    webglOverlay.setMap(map);
    overlayRef.current = webglOverlay;

    return () => {
      // Cleanup on unmount
      console.log('PedestrianNetwork: Cleaning up overlay');
      webglOverlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  /**
   * Dispose a tile group and all its geometries
   * Uses traverse() to recursively dispose nested geometries
   * Handles both individual Line objects and merged LineSegments
   */
  const disposeTileGroup = (tileGroup: THREE.Group, scene: THREE.Scene) => {
    scene.remove(tileGroup);

    // Traverse entire object tree to find all meshes, lines, and line segments
    tileGroup.traverse((obj) => {
      if ((obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments) && obj.geometry) {
        obj.geometry.dispose();
        // Materials are shared via MaterialPalette, so don't dispose them
      }
    });
  };

  // Handle tile ready callback
  const handleTileReady = (tileKey: string, response: WorkerResponse) => {
    const scene = sceneRef.current;
    const anchor = anchorRef.current;
    const materialPalette = materialPaletteRef.current;
    const tileManager = tileManagerRef.current;

    if (!scene || !anchor || !materialPalette || !tileManager) return;

    if (response.error) {
      console.error(`PedestrianNetwork: Tile ${tileKey} decode error:`, response.error);
      return;
    }

    const pedestrianLines = response.pedestrianLines || [];

    // Create tile group
    const tileGroup = new THREE.Group();
    tileGroup.name = `tile-${tileKey}`;

    // Create line meshes from worker data (with geometry merging)
    createLinesFromWorkerData(pedestrianLines, tileGroup, anchor, materialPalette);

    // Log optimization stats
    const mergedObjectCount = tileGroup.children.length;
    console.log(`PedestrianNetwork: ✅ Tile ${tileKey} ready with ${pedestrianLines.length} lines merged into ${mergedObjectCount} objects (${Math.round(pedestrianLines.length / mergedObjectCount)}x reduction)`);

    // Add to scene
    scene.add(tileGroup);

    // Add to cache (evicts LRU if over limit)
    const evictedTiles = tileManager.addToCache(tileKey, tileGroup);

    // Remove evicted tiles from scene and dispose their geometries
    evictedTiles.forEach((evictedGroup) => {
      disposeTileGroup(evictedGroup, scene);
    });

    // Update cache reference
    tileCacheRef.current = tileManager.getCacheMap();

    // Request redraw
    overlayRef.current?.requestRedraw();
  };

  // Create Three.js line geometries from worker data
  // OPTIMIZED: Merges all lines per color into single LineSegments for better performance
  const createLinesFromWorkerData = (
    lines: PedestrianLineData[],
    tileGroup: THREE.Group,
    anchor: { lat: number; lng: number; altitude: number },
    materialPalette: MaterialPalette
  ) => {
    // Group line points by color to merge geometries
    const pointsByColor = new Map<string, THREE.Vector3[]>();
    const metadataByColor = new Map<string, any[]>();

    for (const line of lines) {
      try {
        const { coordinates, color, widthMeters } = line;

        // Validate coordinates
        if (!coordinates || coordinates.length < 2) {
          continue; // Skip invalid/degenerate lines
        }

        // Validate that coordinates are valid numbers
        const validCoords = coordinates.every(
          ([lng, lat]) => typeof lng === 'number' && typeof lat === 'number' &&
                         !isNaN(lng) && !isNaN(lat)
        );
        if (!validCoords) {
          console.warn('PedestrianNetwork: Skipping line with invalid coordinates');
          continue;
        }

        // Convert lat/lng to anchor-relative 3D positions
        const points: THREE.Vector3[] = coordinates.map(([lng, lat]) => {
          const position = latLngAltToVector3(
            { lat, lng, altitude: 0 }, // At ground level (0m) to match camera reference frame
            anchor
          );
          return new THREE.Vector3(position.x, position.y, position.z);
        });

        // Validate that we got valid points
        if (points.length < 2) {
          continue;
        }

        // Group points by color for geometry merging
        const colorKey = `${color}`;
        if (!pointsByColor.has(colorKey)) {
          pointsByColor.set(colorKey, []);
          metadataByColor.set(colorKey, []);
        }

        // Add all points from this line to the color group
        // For LineSegments, we need pairs of points (start, end) for each segment
        const colorPoints = pointsByColor.get(colorKey)!;
        for (let i = 0; i < points.length - 1; i++) {
          colorPoints.push(points[i], points[i + 1]);
        }

        // Store metadata for this line
        metadataByColor.get(colorKey)!.push({
          featureType: line.featureType,
          wheelchair: line.wheelchair,
          weatherProtected: line.weatherProtected,
        });
      } catch (error) {
        console.error('PedestrianNetwork: Failed to process line:', error);
        // Continue processing other lines
      }
    }

    // Create one LineSegments object per color (merged geometry)
    pointsByColor.forEach((points, colorKey) => {
      if (points.length < 2) return;

      try {
        // Create merged geometry from all points for this color
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Get line material from palette (colorKey is already a string)
        const material = materialPalette.getLineMaterial(colorKey);

        // Create LineSegments (more efficient than multiple Line objects)
        const lineSegments = new THREE.LineSegments(geometry, material);

        // Store aggregated metadata
        lineSegments.userData = {
          color: colorKey,
          lineCount: metadataByColor.get(colorKey)?.length || 0,
          metadata: metadataByColor.get(colorKey),
        };

        tileGroup.add(lineSegments);
      } catch (error) {
        console.error(`PedestrianNetwork: Failed to create merged geometry for color ${colorKey}:`, error);
      }
    });
  };

  // Load pedestrian network for current viewport
  const loadPedestrianForViewport = () => {
    const tileManager = tileManagerRef.current;
    const scene = sceneRef.current;

    if (!map || !tileManager || !scene) {
      console.log('PedestrianNetwork: Cannot load viewport - missing dependencies');
      return;
    }

    const zoom = map.getZoom();

    // Throttle viewport logging to every 500ms
    const now = Date.now();
    if (now - lastViewportLogRef.current >= 500) {
      console.log(`PedestrianNetwork: Loading viewport at zoom ${zoom}`);
      lastViewportLogRef.current = now;
    }

    if (!zoom || zoom < MIN_PEDESTRIAN_ZOOM) {
      console.log(`PedestrianNetwork: Zoom ${zoom} below minimum ${MIN_PEDESTRIAN_ZOOM}, clearing tiles`);
      // Clear all tiles below minimum zoom
      const cleared = tileManager.pruneToBounds(new Set());
      cleared.forEach((tileGroup) => {
        disposeTileGroup(tileGroup, scene);
      });
      tileCacheRef.current.clear();
      return;
    }

    // Get viewport bounds
    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Calculate tiles needed for this viewport (clamp to 15-18 range)
    const tileZoom = Math.min(Math.max(Math.floor(zoom), 15), 18);
    const tiles = getTilesInBounds(sw.lat(), sw.lng(), ne.lat(), ne.lng(), tileZoom);

    // Log tile count (throttled with viewport log)
    if (now - lastViewportLogRef.current < 500) {
      console.log(`PedestrianNetwork: Viewport needs ${tiles.length} tiles at z${tileZoom}`);
    }

    // Build set of required tile keys
    const requiredTileKeys = new Set<string>();
    tiles.forEach((tile) => requiredTileKeys.add(`${tile.z}/${tile.x}/${tile.y}`));

    // Prune tiles outside viewport
    const prunedTiles = tileManager.pruneToBounds(requiredTileKeys);
    prunedTiles.forEach((tileGroup) => {
      disposeTileGroup(tileGroup, scene);
    });

    // Calculate center tile for priority (use map center for accuracy)
    const mapCenter = map.getCenter();
    if (!mapCenter) return;

    const centerTile = latLngToTile(mapCenter.lat(), mapCenter.lng(), tileZoom);

    // Request tiles with distance-based priority
    tileManager.requestTiles(
      tiles.map((tile) => ({
        z: tile.z,
        x: tile.x,
        y: tile.y,
        priority: (tile.x - centerTile.x) ** 2 + (tile.y - centerTile.y) ** 2,
      }))
    );

    tileCacheRef.current = tileManager.getCacheMap();
  };

  // Viewport change handler (debounced)
  useEffect(() => {
    if (!map || !isInitialized || !visible || !tileManagerRef.current) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const handleIdle = () => {
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        loadPedestrianForViewport();
        debounceTimer = null;
      }, 150); // 150ms debounce
    };

    const idleListener = map.addListener('idle', handleIdle);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      google.maps.event.removeListener(idleListener);
    };
  }, [map, isInitialized, visible]);

  // Handle visibility changes
  useEffect(() => {
    if (!visible) {
      console.log('PedestrianNetwork: Visibility off, clearing tiles');
      // Clear tiles when hidden
      const scene = sceneRef.current;
      if (scene) {
        scene.clear();
      }
      tileCacheRef.current.clear();
      tileManagerRef.current?.clearAll();
    } else {
      console.log('PedestrianNetwork: Visibility on');
      // When made visible, tiles will load via idle handler
      if (isInitialized && tileManagerRef.current) {
        loadPedestrianForViewport();
      }
      if (overlayRef.current) {
        overlayRef.current.requestRedraw();
      }
    }
  }, [visible, isInitialized]);

  // Handle opacity changes
  useEffect(() => {
    if (materialPaletteRef.current) {
      materialPaletteRef.current.setOpacity(opacity);
      overlayRef.current?.requestRedraw();
    }
  }, [opacity]);

  return null; // This is an overlay, no DOM elements
}

// Helper: Convert lat/lng to tile coordinates
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

// Helper: Get all tiles within bounds
function getTilesInBounds(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  zoom: number
) {
  const swTile = latLngToTile(minLat, minLng, zoom);
  const neTile = latLngToTile(maxLat, maxLng, zoom);

  const tiles = [];
  for (let x = Math.min(swTile.x, neTile.x); x <= Math.max(swTile.x, neTile.x); x++) {
    for (let y = Math.min(swTile.y, neTile.y); y <= Math.max(swTile.y, neTile.y); y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}
