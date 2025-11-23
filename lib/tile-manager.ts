/**
 * TileManager
 *
 * Manages tile lifecycle with:
 * - LRU cache to limit memory usage
 * - Concurrency control for tile loading
 * - Queue management for pending tiles
 * - Integration with Web Worker for off-thread processing
 */

import * as THREE from 'three';
import type { PMTiles } from 'pmtiles';
import type { BuildingData, WorkerResponse } from '@/workers/pmtiles-worker';

export interface TileManagerConfig {
  maxConcurrentLoads: number;  // Max tiles loading at once (e.g., 2-4)
  maxCachedTiles: number;       // Max tiles to keep in memory (e.g., 8-12)
  pmtiles: PMTiles;
  worker: Worker;
  onTileReady: (tileKey: string, response: WorkerResponse) => void;
  requestType?: 'DECODE_TILE' | 'DECODE_PEDESTRIAN_TILE'; // Type of tiles to decode
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

  // LRU cache: Map from tileKey to THREE.Group
  private tileCache: Map<string, THREE.Group> = new Map();

  // Track access order for LRU eviction
  private accessOrder: string[] = [];

  // Currently loading tiles
  private loadingTiles: Set<string> = new Set();

  // Stale tiles (loading but no longer needed)
  private staleTiles: Set<string> = new Set();

  // Queue of tiles waiting to be loaded
  private loadQueue: TileLoadState[] = [];

  // Bound worker listener so we can remove it on dispose
  private handleWorkerMessageBound: (event: MessageEvent<WorkerResponse>) => void;

  // Statistics
  private stats = {
    tilesLoaded: 0,
    tilesEvicted: 0,
    currentlyLoading: 0,
    cacheSize: 0,
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

    // Skip if already in queue
    if (this.loadQueue.some(t => t.tileKey === tileKey)) {
      return;
    }

    // Add to queue
    this.loadQueue.push({ tileKey, z, x, y, priority });

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
    // Remove from queue
    const originalQueueSize = this.loadQueue.length;
    this.loadQueue = this.loadQueue.filter(tile => requiredTileKeys.has(tile.tileKey));
    const removedFromQueue = originalQueueSize - this.loadQueue.length;

    // Mark currently loading tiles as stale if not required
    this.loadingTiles.forEach(tileKey => {
      if (!requiredTileKeys.has(tileKey)) {
        this.staleTiles.add(tileKey);
      }
    });

    if (removedFromQueue > 0 || this.staleTiles.size > 0) {
      console.log(`🚫 Canceled tiles: ${removedFromQueue} from queue, ${this.staleTiles.size} marked stale`);
    }
  }

  /**
   * Process the load queue
   */
  private processQueue(): void {
    // Check if we can start more loads
    while (
      this.loadingTiles.size < this.config.maxConcurrentLoads &&
      this.loadQueue.length > 0
    ) {
      // Sort queue by priority (lower = higher priority)
      this.loadQueue.sort((a, b) => a.priority - b.priority);

      // Get next tile
      const tile = this.loadQueue.shift()!;

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
      const request = {
        type: (this.config.requestType || 'DECODE_TILE') as const,
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

    if (type !== 'TILE_DECODED' && type !== 'PEDESTRIAN_TILE_DECODED') {
      return;
    }

    // Mark as no longer loading
    this.loadingTiles.delete(tileKey);
    this.stats.currentlyLoading = this.loadingTiles.size;

    // Check if tile was marked as stale
    if (this.staleTiles.has(tileKey)) {
      console.log(`⏭️ Skipping stale tile ${tileKey}`);
      this.staleTiles.delete(tileKey);
      this.processQueue();
      return;
    }

    if (error) {
      console.error(`Worker error for tile ${tileKey}:`, error);
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

      console.log(`🗑️ Evicted tile ${tileKey} (cache size: ${this.tileCache.size})`);

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

    if (evicted.length > 0) {
      console.log(`🗑️ Pruned ${evicted.length} out-of-bounds tiles`);
    }

    return evicted;
  }

  /**
   * Clear all tiles
   */
  clearAll(): THREE.Group[] {
    const allTiles = Array.from(this.tileCache.values());

    this.tileCache.clear();
    this.accessOrder = [];
    this.loadQueue = [];
    this.staleTiles.clear();
    this.stats.cacheSize = 0;

    return allTiles;
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.loadQueue.length,
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
    // Detach worker listener so this TileManager can be GC'ed
    this.config.worker.removeEventListener(
      'message',
      this.handleWorkerMessageBound as EventListener,
    );

    // Clear internal state
    this.loadQueue = [];
    this.loadingTiles.clear();
    this.staleTiles.clear();
    this.tileCache.clear();
    this.accessOrder = [];

    this.stats = {
      tilesLoaded: 0,
      tilesEvicted: 0,
      currentlyLoading: 0,
      cacheSize: 0,
    };

    // IMPORTANT: Do NOT terminate the worker here;
    // the owner (BuildingOverlayPMTiles) controls worker lifecycle.
  }
}
