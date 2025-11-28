/**
 * TileManager
 *
 * Manages tile lifecycle with:
 * - LRU cache to limit memory usage
 * - Warm cache for recently-viewed tiles (hidden but retained)
 * - Viewport diffing for incremental updates
 * - Cross-zoom transitions for smooth zoom changes
 * - Concurrency control for tile loading
 * - Queue management for pending tiles
 * - Integration with Web Worker for off-thread processing
 */

import * as THREE from 'three';
import type { PMTiles } from 'pmtiles';
import type { BuildingData, WorkerResponse } from '@/workers/pmtiles-worker';

export interface TileManagerConfig {
  maxConcurrentLoads: number;  // Max tiles loading at once (e.g., 2-4)
  maxCachedTiles: number;       // Max tiles to keep in memory (e.g., 50)
  maxWarmTiles?: number;        // Max hidden tiles to retain (e.g., 24)
  pmtiles: PMTiles;
  worker: Worker;
  onTileReady: (tileKey: string, response: WorkerResponse) => void;
  onTileHide?: (tileKey: string, tileGroup: THREE.Group) => void;  // Called when tile demoted to warm
  onTileShow?: (tileKey: string, tileGroup: THREE.Group) => void;  // Called when tile promoted from warm
  onTileRemove?: (tileKey: string, tileGroup: THREE.Group) => void;  // Called when tile should be removed from scene
  onZoomTransitionComplete?: () => void;  // Called when zoom transition finishes
  requestType?: 'DECODE_TILE' | 'DECODE_PEDESTRIAN_TILE' | 'DECODE_INDOOR_TILE'; // Type of tiles to decode
}

// Result of incremental viewport update
export interface ViewportUpdateResult {
  loaded: number;      // New tiles requested
  pruned: number;      // Tiles removed from hot cache
  unchanged: number;   // Tiles that stayed in viewport
  promoted: number;    // Tiles restored from warm cache
}

// Zoom transition state
interface ZoomTransition {
  fromZoom: number;
  toZoom: number;
  requiredTiles: Set<string>;
  loadedTiles: Set<string>;
  oldZoomTiles: Map<string, THREE.Group>;  // Old tiles to fade out
  startTime: number;
}

interface TileLoadState {
  tileKey: string;
  z: number;
  x: number;
  y: number;
  priority: number;  // Lower = higher priority
}

export class TileManager {
  private config: TileManagerConfig;

  // LRU cache: Map from tileKey to THREE.Group (hot cache - visible tiles)
  private tileCache: Map<string, THREE.Group> = new Map();

  // Warm cache: recently-viewed tiles (hidden but geometry retained)
  private warmCache: Map<string, THREE.Group> = new Map();

  // Track access order for LRU eviction
  private accessOrder: string[] = [];

  // Currently loading tiles
  private loadingTiles: Set<string> = new Set();

  // Stale tiles (loading but no longer needed)
  private staleTiles: Set<string> = new Set();

  // Queue of tiles waiting to be loaded
  private loadQueue: TileLoadState[] = [];

  // Set for O(1) queue lookup (mirrors loadQueue keys)
  private loadQueueSet: Set<string> = new Set();

  // Bound worker listener so we can remove it on dispose
  private handleWorkerMessageBound: (event: MessageEvent<WorkerResponse>) => void;

  // Previous viewport state for diffing
  private previousViewport: { tiles: Set<string>; zoom: number } | null = null;

  // Current zoom transition state
  private zoomTransition: ZoomTransition | null = null;
  private zoomTransitionTimeout: NodeJS.Timeout | null = null;
  private static readonly ZOOM_TRANSITION_TIMEOUT = 2000; // 2 seconds max

  // Statistics
  private stats = {
    tilesLoaded: 0,
    tilesEvicted: 0,
    currentlyLoading: 0,
    cacheSize: 0,
    warmCacheSize: 0,
  };

  constructor(config: TileManagerConfig) {
    this.config = config;

    // Bind once so we can remove the listener properly in dispose()
    this.handleWorkerMessageBound = this.handleWorkerMessage.bind(this);
    this.config.worker.addEventListener(
      'message',
      this.handleWorkerMessageBound as EventListener,
    );
  }

  /**
   * Request a tile to be loaded
   */
  requestTile(z: number, x: number, y: number, priority: number = 0): void {
    const tileKey = `${z}/${x}/${y}`;

    // Skip if already cached or loading
    if (this.tileCache.has(tileKey) || this.loadingTiles.has(tileKey)) {
      // Update access order if already cached
      if (this.tileCache.has(tileKey)) {
        this.markAccessed(tileKey);
      }
      return;
    }

    // Skip if already in queue (O(1) lookup)
    if (this.loadQueueSet.has(tileKey)) {
      return;
    }

    // Add to queue and Set
    this.loadQueue.push({ tileKey, z, x, y, priority });
    this.loadQueueSet.add(tileKey);

    // Process queue
    this.processQueue();
  }

  /**
   * Request multiple tiles and cancel any not in this set
   */
  requestTiles(tiles: Array<{ z: number; x: number; y: number; priority?: number }>): void {
    // Build set of required tile keys
    const requiredTileKeys = new Set<string>();
    tiles.forEach(tile => {
      requiredTileKeys.add(`${tile.z}/${tile.x}/${tile.y}`);
    });

    // Cancel tiles not in the required set
    this.cancelTilesNotIn(requiredTileKeys);

    // Request all tiles
    tiles.forEach(tile => this.requestTile(tile.z, tile.x, tile.y, tile.priority || 0));
  }

  /**
   * Cancel tiles that are not in the required set
   */
  cancelTilesNotIn(requiredTileKeys: Set<string>): void {
    // Remove from queue and update Set
    const originalQueueSize = this.loadQueue.length;
    const removedKeys: string[] = [];
    this.loadQueue = this.loadQueue.filter(tile => {
      if (requiredTileKeys.has(tile.tileKey)) {
        return true;
      }
      removedKeys.push(tile.tileKey);
      return false;
    });
    removedKeys.forEach(key => this.loadQueueSet.delete(key));
    const removedFromQueue = originalQueueSize - this.loadQueue.length;

    // Mark currently loading tiles as stale if not required
    this.loadingTiles.forEach(tileKey => {
      if (!requiredTileKeys.has(tileKey)) {
        this.staleTiles.add(tileKey);
      }
    });

  }

  /**
   * Process the load queue
   */
  private processQueue(): void {
    // Sort queue ONCE before processing (not per iteration)
    if (this.loadQueue.length > 1) {
      this.loadQueue.sort((a, b) => a.priority - b.priority);
    }

    // Check if we can start more loads
    while (
      this.loadingTiles.size < this.config.maxConcurrentLoads &&
      this.loadQueue.length > 0
    ) {
      // Get next tile
      const tile = this.loadQueue.shift()!;
      this.loadQueueSet.delete(tile.tileKey);

      // Start loading
      this.startTileLoad(tile.z, tile.x, tile.y);
    }
  }

  /**
   * Start loading a tile
   */
  private async startTileLoad(z: number, x: number, y: number): Promise<void> {
    const tileKey = `${z}/${x}/${y}`;

    // Mark as loading
    this.loadingTiles.add(tileKey);
    this.stats.currentlyLoading = this.loadingTiles.size;

    try {
      // Fetch tile data from PMTiles
      const tileData = await this.config.pmtiles.getZxy(z, x, y);

      if (!tileData || !tileData.data) {
        // Tile doesn't exist (no buildings)
        this.loadingTiles.delete(tileKey);
        this.stats.currentlyLoading = this.loadingTiles.size;
        this.processQueue();
        return;
      }

      // Send to worker for processing
      const requestType = this.config.requestType || 'DECODE_TILE';
      const request = {
        type: requestType,
        z,
        x,
        y,
        buffer: tileData.data,
      };

      this.config.worker.postMessage(request, [tileData.data]);
    } catch (error) {
      console.error(`Failed to load tile ${tileKey}:`, error);
      this.loadingTiles.delete(tileKey);
      this.stats.currentlyLoading = this.loadingTiles.size;
      this.processQueue();
    }
  }

  /**
   * Handle worker response
   */
  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { type, tileKey, error } = event.data;

    if (type !== 'TILE_DECODED' && type !== 'PEDESTRIAN_TILE_DECODED' && type !== 'INDOOR_TILE_DECODED') {
      return;
    }

    // Mark as no longer loading
    this.loadingTiles.delete(tileKey);
    this.stats.currentlyLoading = this.loadingTiles.size;

    // Check if tile was marked as stale
    if (this.staleTiles.has(tileKey)) {
      this.staleTiles.delete(tileKey);
      this.processQueue();
      return;
    }

    if (error) {
      this.processQueue();
      return;
    }

    // Notify caller with full response
    this.config.onTileReady(tileKey, event.data);

    // Continue processing queue
    this.processQueue();
  }

  /**
   * Add a tile to the cache
   * Returns any tiles that were evicted to make room
   */
  addToCache(tileKey: string, tileGroup: THREE.Group): THREE.Group[] {
    const evicted: THREE.Group[] = [];

    // Evict old tiles if cache is full
    while (this.tileCache.size >= this.config.maxCachedTiles) {
      const evictedTile = this.evictOldestTile();
      if (evictedTile) {
        evicted.push(evictedTile);
      }
    }

    // Add to cache
    this.tileCache.set(tileKey, tileGroup);
    this.markAccessed(tileKey);

    this.stats.tilesLoaded++;
    this.stats.cacheSize = this.tileCache.size;

    return evicted;
  }

  /**
   * Get a tile from cache
   */
  getFromCache(tileKey: string): THREE.Group | undefined {
    const tile = this.tileCache.get(tileKey);
    if (tile) {
      this.markAccessed(tileKey);
    }
    return tile;
  }

  /**
   * Check if a tile is cached
   */
  isCached(tileKey: string): boolean {
    return this.tileCache.has(tileKey);
  }

  /**
   * Mark a tile as accessed (for LRU tracking)
   */
  private markAccessed(tileKey: string): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(tileKey);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Add to end (most recently used)
    this.accessOrder.push(tileKey);
  }

  /**
   * Evict the least recently used tile
   * Returns the evicted tile group so caller can remove it from scene
   */
  private evictOldestTile(): THREE.Group | null {
    if (this.accessOrder.length === 0) {
      return null;
    }

    // Get least recently used tile
    const tileKey = this.accessOrder.shift()!;
    const tileGroup = this.tileCache.get(tileKey);

    if (tileGroup) {
      // Remove from cache
      this.tileCache.delete(tileKey);
      this.stats.tilesEvicted++;
      this.stats.cacheSize = this.tileCache.size;

      // Return tile group so caller can remove from scene and dispose
      return tileGroup;
    }

    return null;
  }


  /**
   * Prune tiles that are not in the visible set
   */
  pruneToBounds(visibleTileKeys: Set<string>): THREE.Group[] {
    const evicted: THREE.Group[] = [];

    // Find tiles to evict (not in visible set)
    const tilesToEvict: string[] = [];
    this.tileCache.forEach((_, tileKey) => {
      if (!visibleTileKeys.has(tileKey)) {
        tilesToEvict.push(tileKey);
      }
    });

    // Evict them
    tilesToEvict.forEach(tileKey => {
      const tileGroup = this.tileCache.get(tileKey);
      if (tileGroup) {
        evicted.push(tileGroup);
        this.tileCache.delete(tileKey);

        // Remove from access order
        const index = this.accessOrder.indexOf(tileKey);
        if (index !== -1) {
          this.accessOrder.splice(index, 1);
        }

        this.stats.tilesEvicted++;
      }
    });

    this.stats.cacheSize = this.tileCache.size;

    return evicted;
  }

  /**
   * Clear all tiles (hot cache, warm cache, and zoom transition tiles)
   */
  clearAll(): THREE.Group[] {
    // Include zoom transition tiles that are still in scene
    const zoomTransitionTiles = this.zoomTransition
      ? Array.from(this.zoomTransition.oldZoomTiles.values())
      : [];

    const allTiles = [
      ...Array.from(this.tileCache.values()),
      ...Array.from(this.warmCache.values()),
      ...zoomTransitionTiles,
    ];

    this.tileCache.clear();
    this.warmCache.clear();
    this.accessOrder = [];
    this.loadQueue = [];
    this.loadQueueSet.clear();
    this.staleTiles.clear();
    this.previousViewport = null;
    this.cancelZoomTransition();
    this.stats.cacheSize = 0;
    this.stats.warmCacheSize = 0;

    return allTiles;
  }

  // ============================================
  // PHASE 1: VIEWPORT DIFFING
  // ============================================

  /**
   * Update viewport with incremental diffing
   * Only requests NEW tiles and prunes EXITED tiles
   */
  updateViewportIncremental(
    tiles: Array<{ z: number; x: number; y: number; priority?: number }>,
    currentZoom: number
  ): ViewportUpdateResult {
    const currentTileKeys = new Set<string>();
    tiles.forEach(t => currentTileKeys.add(`${t.z}/${t.x}/${t.y}`));

    // Check for zoom change - may trigger transition
    if (this.previousViewport && this.previousViewport.zoom !== currentZoom) {
      return this.handleZoomChange(tiles, currentTileKeys, currentZoom);
    }

    // No previous state - first load
    if (!this.previousViewport) {
      this.previousViewport = { tiles: currentTileKeys, zoom: currentZoom };

      // Check warm cache for any tiles we can restore
      let promoted = 0;
      tiles.forEach(t => {
        const key = `${t.z}/${t.x}/${t.y}`;
        if (this.promoteFromWarm(key)) {
          promoted++;
        } else if (!this.tileCache.has(key) && !this.loadingTiles.has(key)) {
          this.requestTile(t.z, t.x, t.y, t.priority || 0);
        }
      });

      return { loaded: tiles.length - promoted, pruned: 0, unchanged: 0, promoted };
    }

    const previousTiles = this.previousViewport.tiles;
    let promoted = 0;

    // Tiles to load = in current but not in previous (and not cached/warm)
    const tilesToLoad: typeof tiles = [];
    tiles.forEach(t => {
      const key = `${t.z}/${t.x}/${t.y}`;
      if (!previousTiles.has(key)) {
        // New tile - check warm cache first
        if (this.promoteFromWarm(key)) {
          promoted++;
        } else if (!this.tileCache.has(key) && !this.loadingTiles.has(key)) {
          tilesToLoad.push(t);
        }
      }
    });

    // Tiles to demote = in previous but not in current
    const tilesToDemote: string[] = [];
    previousTiles.forEach(key => {
      if (!currentTileKeys.has(key) && this.tileCache.has(key)) {
        tilesToDemote.push(key);
      }
    });

    // Unchanged = intersection (tiles that stayed)
    const unchanged = tiles.length - tilesToLoad.length - promoted;

    // Update previous viewport state
    this.previousViewport = { tiles: currentTileKeys, zoom: currentZoom };

    // Demote tiles that left viewport (move to warm cache)
    tilesToDemote.forEach(key => this.demoteToWarm(key));

    // Cancel any loading tiles not in current viewport
    this.cancelTilesNotIn(currentTileKeys);

    // Request only new tiles
    tilesToLoad.forEach(t => this.requestTile(t.z, t.x, t.y, t.priority || 0));

    return {
      loaded: tilesToLoad.length,
      pruned: tilesToDemote.length,
      unchanged,
      promoted,
    };
  }

  /**
   * Clear viewport state (call when filter/visibility changes)
   */
  clearViewportState(): void {
    this.previousViewport = null;
    this.cancelZoomTransition();
  }

  // ============================================
  // PHASE 2: WARM CACHE
  // ============================================

  /**
   * Demote a tile from hot to warm cache (hide but retain geometry)
   */
  demoteToWarm(tileKey: string): boolean {
    const tile = this.tileCache.get(tileKey);
    if (!tile) return false;

    // Remove from hot cache
    this.tileCache.delete(tileKey);
    const index = this.accessOrder.indexOf(tileKey);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // Evict from warm cache if full
    const maxWarm = this.config.maxWarmTiles ?? 24;
    while (this.warmCache.size >= maxWarm) {
      const oldestKey = this.warmCache.keys().next().value;
      if (oldestKey) {
        const evictedTile = this.warmCache.get(oldestKey);
        this.warmCache.delete(oldestKey);
        if (evictedTile) {
          // Remove from scene and dispose this tile - it's being evicted from warm
          this.config.onTileRemove?.(oldestKey, evictedTile);
          this.disposeTileGroup(evictedTile);
          this.stats.tilesEvicted++;
        }
      }
    }

    // Add to warm cache
    this.warmCache.set(tileKey, tile);

    // Notify callback to hide the tile
    this.config.onTileHide?.(tileKey, tile);

    this.stats.cacheSize = this.tileCache.size;
    this.stats.warmCacheSize = this.warmCache.size;

    return true;
  }

  /**
   * Promote a tile from warm to hot cache (show it again)
   * Returns true if tile was found and promoted
   */
  promoteFromWarm(tileKey: string): boolean {
    const tile = this.warmCache.get(tileKey);
    if (!tile) return false;

    // Remove from warm cache
    this.warmCache.delete(tileKey);

    // Add to hot cache
    this.tileCache.set(tileKey, tile);
    this.markAccessed(tileKey);

    // Notify callback to show the tile
    this.config.onTileShow?.(tileKey, tile);

    this.stats.cacheSize = this.tileCache.size;
    this.stats.warmCacheSize = this.warmCache.size;

    return true;
  }

  /**
   * Check if tile is available (in hot or warm cache)
   */
  isAvailable(tileKey: string): boolean {
    return this.tileCache.has(tileKey) || this.warmCache.has(tileKey);
  }

  /**
   * Dispose a tile group (geometry cleanup)
   */
  private disposeTileGroup(tileGroup: THREE.Group): void {
    tileGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        // Don't dispose materials - they're shared via MaterialPalette
      }
      if (obj instanceof THREE.LineSegments) {
        obj.geometry?.dispose();
      }
    });
  }

  // ============================================
  // PHASE 3: CROSS-ZOOM TRANSITIONS
  // ============================================

  /**
   * Handle zoom level change with smooth transition
   */
  private handleZoomChange(
    tiles: Array<{ z: number; x: number; y: number; priority?: number }>,
    currentTileKeys: Set<string>,
    newZoom: number
  ): ViewportUpdateResult {
    const oldZoom = this.previousViewport?.zoom ?? newZoom;

    // Cancel any existing transition
    this.cancelZoomTransition();

    // Save old tiles for transition (don't remove them yet)
    const oldZoomTiles = new Map<string, THREE.Group>();
    this.tileCache.forEach((tile, key) => {
      oldZoomTiles.set(key, tile);
    });

    // Start zoom transition
    this.zoomTransition = {
      fromZoom: oldZoom,
      toZoom: newZoom,
      requiredTiles: currentTileKeys,
      loadedTiles: new Set(),
      oldZoomTiles,
      startTime: performance.now(),
    };

    // Set timeout to force-complete transition
    this.zoomTransitionTimeout = setTimeout(() => {
      if (this.zoomTransition) {
        this.completeZoomTransition();
      }
    }, TileManager.ZOOM_TRANSITION_TIMEOUT);

    // Update viewport state
    this.previousViewport = { tiles: currentTileKeys, zoom: newZoom };

    // Clear hot cache (tiles stay in oldZoomTiles for transition)
    this.tileCache.clear();
    this.accessOrder = [];
    this.stats.cacheSize = 0;

    // Request new zoom tiles
    tiles.forEach(t => this.requestTile(t.z, t.x, t.y, t.priority || 0));

    return {
      loaded: tiles.length,
      pruned: 0,  // Old tiles kept visible during transition
      unchanged: 0,
      promoted: 0,
    };
  }

  /**
   * Called when a new tile is ready during zoom transition
   */
  onZoomTileReady(tileKey: string): void {
    if (!this.zoomTransition) return;

    this.zoomTransition.loadedTiles.add(tileKey);

    // Check if all required tiles are loaded
    const allLoaded = [...this.zoomTransition.requiredTiles].every(
      key => this.zoomTransition!.loadedTiles.has(key) || this.tileCache.has(key)
    );

    if (allLoaded) {
      this.completeZoomTransition();
    }
  }

  /**
   * Check if zoom transition is in progress
   */
  hasZoomTransition(): boolean {
    return this.zoomTransition !== null;
  }

  /**
   * Get tiles to fade out during zoom transition
   */
  getTransitionOldTiles(): Map<string, THREE.Group> | null {
    return this.zoomTransition?.oldZoomTiles ?? null;
  }

  /**
   * Complete zoom transition - remove old tiles from scene and dispose
   */
  completeZoomTransition(): void {
    if (!this.zoomTransition) return;

    const oldTiles = this.zoomTransition.oldZoomTiles;

    // Remove from scene and dispose old zoom tiles
    oldTiles.forEach((tile, key) => {
      this.config.onTileRemove?.(key, tile);  // Remove from scene
      this.disposeTileGroup(tile);
      this.stats.tilesEvicted++;
    });

    // Clear transition state
    this.cancelZoomTransition();

    // Notify callback
    this.config.onZoomTransitionComplete?.();
  }

  /**
   * Cancel zoom transition
   */
  private cancelZoomTransition(): void {
    if (this.zoomTransitionTimeout) {
      clearTimeout(this.zoomTransitionTimeout);
      this.zoomTransitionTimeout = null;
    }
    this.zoomTransition = null;
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.loadQueue.length,
      warmCacheSize: this.warmCache.size,
      hasZoomTransition: this.zoomTransition !== null,
    };
  }

  /**
   * Get all cached tile keys
   */
  getCachedTileKeys(): string[] {
    return Array.from(this.tileCache.keys());
  }

  /**
   * Get the cache map (for external access)
   */
  getCacheMap(): Map<string, THREE.Group> {
    return this.tileCache;
  }

  /**
   * Cleanup - removes worker listener and clears all internal state
   * IMPORTANT: Does NOT terminate worker (owner controls worker lifecycle)
   */
  dispose(): void {
    // Dispose zoom transition tiles BEFORE canceling (they're still in scene)
    if (this.zoomTransition) {
      this.zoomTransition.oldZoomTiles.forEach((tile, key) => {
        this.config.onTileRemove?.(key, tile);
        this.disposeTileGroup(tile);
      });
    }
    this.cancelZoomTransition();

    // Detach worker listener so this TileManager can be GC'ed
    this.config.worker.removeEventListener(
      'message',
      this.handleWorkerMessageBound as EventListener,
    );

    // Dispose HOT cache tiles (was missing!)
    this.tileCache.forEach((tile, key) => {
      this.config.onTileRemove?.(key, tile);
      this.disposeTileGroup(tile);
    });
    this.tileCache.clear();

    // Dispose warm cache tiles
    this.warmCache.forEach((tile, key) => {
      this.config.onTileRemove?.(key, tile);
      this.disposeTileGroup(tile);
    });
    this.warmCache.clear();

    // Clear internal state
    this.loadQueue = [];
    this.loadQueueSet.clear();
    this.loadingTiles.clear();
    this.staleTiles.clear();
    this.accessOrder = [];
    this.previousViewport = null;

    this.stats = {
      tilesLoaded: 0,
      tilesEvicted: 0,
      currentlyLoading: 0,
      cacheSize: 0,
      warmCacheSize: 0,
    };

    // IMPORTANT: Do NOT terminate the worker here;
    // the owner (BuildingOverlayPMTiles) controls worker lifecycle.
  }
}
