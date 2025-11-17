import { useEffect, useRef, useCallback, useState } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { SpatialIndex, googleBoundsToBounds, expandBounds, type Bounds } from '@/lib/spatial-index';

export interface MarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  data: any;
}

export interface MarkerConfig {
  createMarkerElement: (item: MarkerItem) => HTMLElement;
  getZIndex?: (item: MarkerItem) => number;
  getPriority?: (item: MarkerItem) => 'required' | 'optional';
  shouldUpdate?: (item: MarkerItem, prevItem: MarkerItem) => boolean;
}

interface MarkerData {
  marker: google.maps.marker.AdvancedMarkerElement;
  item: MarkerItem;
  isAttached: boolean;
}

export function useOptimizedMarkers(
  items: MarkerItem[],
  config: MarkerConfig,
  options: {
    enabled?: boolean;
    minZoom?: number;
    maxZoom?: number;
    bufferPercentage?: number;
  } = {}
) {
  const map = useMap();
  const markerLib = useMapsLibrary('marker');
  const markersRef = useRef<Map<string, MarkerData>>(new Map());
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex());
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const configRef = useRef<MarkerConfig>(config);

  // Update config ref when it changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const {
    enabled = true,
    minZoom = 0,
    maxZoom = 22,
    bufferPercentage = 0.15,
  } = options;

  // Update spatial index when items change
  useEffect(() => {
    if (!enabled) return;

    const points = items.map(item => ({
      id: item.id,
      lat: item.latitude,
      lng: item.longitude,
    }));

    spatialIndexRef.current.rebuild(points);
  }, [items, enabled]);

  // Create or update markers
  const updateMarkers = useCallback(() => {
    if (!map || !enabled || !markerLib) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const currentZoom = map.getZoom() ?? 11;

    // Check zoom level constraints
    if (currentZoom < minZoom || currentZoom > maxZoom) {
      // Detach all markers outside zoom range
      markersRef.current.forEach(markerData => {
        if (markerData.isAttached) {
          markerData.marker.map = null;
          markerData.isAttached = false;
        }
      });
      setVisibleIds(new Set());
      return;
    }

    // Get visible points from spatial index
    const viewportBounds = expandBounds(
      googleBoundsToBounds(bounds),
      bufferPercentage
    );
    const visiblePoints = spatialIndexRef.current.getPointsInBounds(viewportBounds);
    const visibleIdsSet = new Set(visiblePoints.map(p => p.id));

    // Create a map for quick lookup
    const itemsMap = new Map(items.map(item => [item.id, item]));

    // Update markers in requestAnimationFrame for better performance
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const newVisibleIds = new Set<string>();

      // Process visible markers
      visiblePoints.forEach(point => {
        const item = itemsMap.get(point.id);
        if (!item) return;

        const existingMarkerData = markersRef.current.get(item.id);

        if (existingMarkerData) {
          // Marker exists - check if we need to update it
          const priority = configRef.current.getPriority?.(item) ?? 'optional';
          const prevPriority = configRef.current.getPriority?.(existingMarkerData.item) ?? 'optional';
          const shouldUpdate =
            configRef.current.shouldUpdate?.(item, existingMarkerData.item) ?? false;
          const priorityChanged = priority !== prevPriority;

          if (shouldUpdate) {
            // Update marker content
            const newContent = configRef.current.createMarkerElement(item);
            existingMarkerData.marker.content = newContent;
            existingMarkerData.item = item;
          }

          // Update collision behavior if priority changed
          if (priorityChanged) {
            existingMarkerData.marker.collisionBehavior =
              priority === 'required'
                ? markerLib.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL
                : markerLib.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY;
          }

          // Update zIndex
          const zIndex = configRef.current.getZIndex?.(item) ?? 0;
          existingMarkerData.marker.zIndex = zIndex;

          // Attach if not already attached
          if (!existingMarkerData.isAttached) {
            existingMarkerData.marker.map = map;
            existingMarkerData.isAttached = true;
          }

          newVisibleIds.add(item.id);
        } else {
          // Create new marker
          const content = configRef.current.createMarkerElement(item);
          const priority = configRef.current.getPriority?.(item) ?? 'optional';
          const zIndex = configRef.current.getZIndex?.(item) ?? 0;

          const marker = new markerLib.AdvancedMarkerElement({
            position: { lat: item.latitude, lng: item.longitude },
            map,
            content,
            zIndex,
            collisionBehavior:
              priority === 'required'
                ? markerLib.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL
                : markerLib.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY,
          });

          markersRef.current.set(item.id, {
            marker,
            item,
            isAttached: true,
          });

          newVisibleIds.add(item.id);
        }
      });

      // Detach markers that are no longer visible
      markersRef.current.forEach((markerData, id) => {
        if (!visibleIdsSet.has(id) && markerData.isAttached) {
          markerData.marker.map = null;
          markerData.isAttached = false;
        }
      });

      // Clean up markers for items that no longer exist
      const currentItemIds = new Set(items.map(i => i.id));
      const idsToDelete: string[] = [];

      markersRef.current.forEach((markerData, id) => {
        if (!currentItemIds.has(id)) {
          markerData.marker.map = null;
          idsToDelete.push(id);
        }
      });

      idsToDelete.forEach(id => markersRef.current.delete(id));

      setVisibleIds(newVisibleIds);
    });
  }, [map, items, enabled, minZoom, maxZoom, bufferPercentage, markerLib]);

  // Listen to map events
  useEffect(() => {
    if (!map || !enabled || !markerLib) return;

    const idleListener = map.addListener('idle', updateMarkers);
    const zoomListener = map.addListener('zoom_changed', updateMarkers);

    // Initial update
    updateMarkers();

    return () => {
      if (idleListener) google.maps.event.removeListener(idleListener);
      if (zoomListener) google.maps.event.removeListener(zoomListener);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [map, enabled, markerLib, updateMarkers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(markerData => {
        markerData.marker.map = null;
      });
      markersRef.current.clear();
    };
  }, []);

  // Function to get a specific marker
  const getMarker = useCallback((id: string) => {
    return markersRef.current.get(id)?.marker;
  }, []);

  // Function to update a specific marker
  const updateMarker = useCallback(
    (id: string, updater: (item: MarkerItem) => MarkerItem) => {
      const markerData = markersRef.current.get(id);
      if (!markerData) return;

      const updatedItem = updater(markerData.item);
      const newContent = configRef.current.createMarkerElement(updatedItem);

      markerData.marker.content = newContent;
      markerData.item = updatedItem;
    },
    []
  );

  return {
    visibleIds,
    visibleCount: visibleIds.size,
    totalCount: items.length,
    getMarker,
    updateMarker,
  };
}
