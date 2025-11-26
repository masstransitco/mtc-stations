import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import Supercluster from 'supercluster';
import type { MeteredCarpark } from '@/types/metered-carpark';

// Properties accumulated during clustering (via map/reduce)
interface AccumulatedProps {
  sum_vacant_spaces: number;
}

// Full cluster properties (Supercluster adds cluster, cluster_id, point_count automatically)
export interface ClusterProperties {
  cluster: true;
  cluster_id: number;
  point_count: number;
  sum_vacant_spaces: number;
}

// Point properties (individual carparks when not clustered)
export interface PointProperties extends MeteredCarpark {
  cluster?: false;
}

// Union type for cluster or point features
export type ClusterOrPoint =
  | GeoJSON.Feature<GeoJSON.Point, ClusterProperties>
  | GeoJSON.Feature<GeoJSON.Point, PointProperties>;

interface ClusterMarkerData {
  marker: google.maps.marker.AdvancedMarkerElement;
  clusterId: number;
  pointCount: number;
  vacantSpaces: number;
  isAttached: boolean;
}

interface UseMeteredClustersOptions {
  enabled?: boolean;
  minZoom?: number;
  maxZoom?: number;
  radius?: number;
}

// Create cluster marker DOM element
function createClusterMarkerElement(
  pointCount: number,
  vacantSpaces: number,
  onClick: () => void
): HTMLElement {
  const container = document.createElement('div');

  // Size scales slightly with point count (28-40px)
  const size = Math.min(40, Math.max(28, 24 + Math.sqrt(pointCount) * 3));

  container.style.width = `${size}px`;
  container.style.height = `${size}px`;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.transition = 'transform 150ms ease-out';

  // Main circle - neutral gray styling
  const circle = document.createElement('div');
  circle.style.width = '100%';
  circle.style.height = '100%';
  circle.style.borderRadius = '50%';
  circle.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
  circle.style.border = '1.5px solid #d1d5db';
  circle.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.15)';
  circle.style.display = 'flex';
  circle.style.alignItems = 'center';
  circle.style.justifyContent = 'center';
  circle.style.transition = 'all 150ms ease-out';
  circle.style.boxSizing = 'border-box';

  // Vacant count text
  const countText = document.createElement('span');
  countText.textContent = `${vacantSpaces}`;
  countText.style.fontSize = `${Math.max(11, size / 3)}px`;
  countText.style.fontWeight = '600';
  countText.style.color = '#374151';
  countText.style.lineHeight = '1';
  countText.style.userSelect = 'none';
  countText.style.pointerEvents = 'none';

  circle.appendChild(countText);
  container.appendChild(circle);

  // Hover effects
  container.addEventListener('mouseenter', () => {
    container.style.transform = 'scale(1.08)';
    circle.style.border = '2px solid #9ca3af';
  });

  container.addEventListener('mouseleave', () => {
    container.style.transform = 'scale(1)';
    circle.style.border = '1.5px solid #d1d5db';
  });

  container.addEventListener('click', onClick);

  return container;
}

export function useMeteredClusters(
  carparks: MeteredCarpark[],
  options: UseMeteredClustersOptions = {}
) {
  const map = useMap();
  const markerLib = useMapsLibrary('marker');
  const superclusterRef = useRef<Supercluster<PointProperties, AccumulatedProps>>();
  const markersRef = useRef<Map<number, ClusterMarkerData>>(new Map());
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadedRef = useRef(false);

  const { enabled = true, minZoom = 10, maxZoom = 15, radius = 60 } = options;

  // Initialize Supercluster with vacant_spaces aggregation
  // Note: Supercluster only supports integer zoom levels, so we floor them here
  // The fractional maxZoom is used for visibility checks in updateClusterMarkers
  useEffect(() => {
    isLoadedRef.current = false; // Reset loaded state when reinitializing
    superclusterRef.current = new Supercluster({
      radius,
      maxZoom: Math.floor(maxZoom),
      minZoom: Math.floor(minZoom),
      map: (props) => ({
        sum_vacant_spaces: props.vacant_spaces || 0,
      }),
      reduce: (accumulated, props) => {
        accumulated.sum_vacant_spaces += props.sum_vacant_spaces;
      },
    });
  }, [radius, maxZoom, minZoom]);

  // Load points into Supercluster when carparks change
  useEffect(() => {
    if (!superclusterRef.current || carparks.length === 0) {
      isLoadedRef.current = false;
      return;
    }

    const points: GeoJSON.Feature<GeoJSON.Point, PointProperties>[] = carparks.map((carpark) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [carpark.longitude, carpark.latitude],
      },
      properties: { ...carpark },
    }));

    superclusterRef.current.load(points);
    isLoadedRef.current = true;
  }, [carparks]);

  // Zoom to cluster on click
  const zoomToCluster = useCallback(
    (clusterId: number) => {
      if (!map || !superclusterRef.current) return;

      const expansionZoom = superclusterRef.current.getClusterExpansionZoom(clusterId);
      const markerData = markersRef.current.get(clusterId);

      if (markerData) {
        const position = markerData.marker.position;
        if (position) {
          map.panTo(position);
          map.setZoom(Math.min(expansionZoom, maxZoom + 1));
        }
      }
    },
    [map, maxZoom]
  );

  // Update cluster markers - manages AdvancedMarkerElement instances directly
  const updateClusterMarkers = useCallback(() => {
    if (!map || !superclusterRef.current || !markerLib || !enabled || !isLoadedRef.current) {
      // Detach all markers when disabled or not ready
      markersRef.current.forEach((markerData) => {
        if (markerData.isAttached) {
          markerData.marker.map = null;
          markerData.isAttached = false;
        }
      });
      return;
    }

    const bounds = map.getBounds();
    const zoom = map.getZoom() ?? 11;

    // Outside zoom range - detach all markers
    if (zoom < minZoom || zoom > maxZoom || !bounds) {
      markersRef.current.forEach((markerData) => {
        if (markerData.isAttached) {
          markerData.marker.map = null;
          markerData.isAttached = false;
        }
      });
      return;
    }

    // Get clusters from Supercluster
    const bbox: [number, number, number, number] = [
      bounds.getSouthWest().lng(),
      bounds.getSouthWest().lat(),
      bounds.getNorthEast().lng(),
      bounds.getNorthEast().lat(),
    ];

    const clusters = superclusterRef.current.getClusters(bbox, Math.floor(zoom));
    const visibleClusterIds = new Set<number>();

    // Process each cluster
    clusters.forEach((feature) => {
      // Only process cluster features, not individual points
      if (!feature.properties.cluster) return;

      const { cluster_id, point_count, sum_vacant_spaces } = feature.properties as ClusterProperties;
      const [lng, lat] = feature.geometry.coordinates;

      visibleClusterIds.add(cluster_id);

      const existingMarkerData = markersRef.current.get(cluster_id);

      if (existingMarkerData) {
        // Marker exists - check if we need to update content
        const dataChanged =
          existingMarkerData.pointCount !== point_count ||
          existingMarkerData.vacantSpaces !== sum_vacant_spaces;

        if (dataChanged) {
          // Recreate content with new data
          const newContent = createClusterMarkerElement(
            point_count,
            sum_vacant_spaces,
            () => zoomToCluster(cluster_id)
          );
          existingMarkerData.marker.content = newContent;
          existingMarkerData.pointCount = point_count;
          existingMarkerData.vacantSpaces = sum_vacant_spaces;
        }

        // Update position if needed (clusters can shift slightly)
        existingMarkerData.marker.position = { lat, lng };

        // Attach if not already attached
        if (!existingMarkerData.isAttached) {
          existingMarkerData.marker.map = map;
          existingMarkerData.isAttached = true;
        }
      } else {
        // Create new marker
        const content = createClusterMarkerElement(
          point_count,
          sum_vacant_spaces,
          () => zoomToCluster(cluster_id)
        );

        const marker = new markerLib.AdvancedMarkerElement({
          position: { lat, lng },
          map,
          content,
          zIndex: 50,
          collisionBehavior: markerLib.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY,
        });

        markersRef.current.set(cluster_id, {
          marker,
          clusterId: cluster_id,
          pointCount: point_count,
          vacantSpaces: sum_vacant_spaces,
          isAttached: true,
        });
      }
    });

    // Detach markers that are no longer visible
    markersRef.current.forEach((markerData, clusterId) => {
      if (!visibleClusterIds.has(clusterId) && markerData.isAttached) {
        markerData.marker.map = null;
        markerData.isAttached = false;
      }
    });

    // Clean up old markers that haven't been used in a while
    // Keep detached markers for potential reuse, but clean up if map of markers gets too large
    if (markersRef.current.size > 200) {
      const idsToDelete: number[] = [];
      markersRef.current.forEach((markerData, clusterId) => {
        if (!markerData.isAttached) {
          markerData.marker.map = null;
          idsToDelete.push(clusterId);
        }
      });
      idsToDelete.forEach((id) => markersRef.current.delete(id));
    }
  }, [map, markerLib, enabled, minZoom, maxZoom, zoomToCluster]);

  // Listen to map idle events with debouncing
  useEffect(() => {
    if (!map || !markerLib) return;

    // Debounced update handler
    const debouncedUpdate = () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      idleTimeoutRef.current = setTimeout(() => {
        updateClusterMarkers();
      }, 100); // 100ms debounce matches useOptimizedMarkers
    };

    const idleListener = map.addListener('idle', debouncedUpdate);

    // Initial update
    updateClusterMarkers();

    return () => {
      google.maps.event.removeListener(idleListener);
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [map, markerLib, updateClusterMarkers]);

  // Handle enabled state changes
  useEffect(() => {
    if (!map || !markerLib) return;

    if (!enabled) {
      // Detach all markers when disabled
      markersRef.current.forEach((markerData) => {
        if (markerData.isAttached) {
          markerData.marker.map = null;
          markerData.isAttached = false;
        }
      });
    } else {
      // Update markers when enabled
      updateClusterMarkers();
    }
  }, [enabled, map, markerLib, updateClusterMarkers]);

  // Trigger update when carparks data changes
  useEffect(() => {
    if (!map || !markerLib || !enabled) return;
    updateClusterMarkers();
  }, [carparks, map, markerLib, enabled, updateClusterMarkers]);

  // Handle map instance changes (e.g., theme change)
  const previousMapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!map || !markerLib) return;

    if (previousMapRef.current && previousMapRef.current !== map) {
      // Map instance changed - reattach all markers
      markersRef.current.forEach((markerData) => {
        if (markerData.isAttached) {
          markerData.marker.map = map;
        }
      });
      updateClusterMarkers();
    }

    previousMapRef.current = map;
  }, [map, markerLib, updateClusterMarkers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((markerData) => {
        markerData.marker.map = null;
      });
      markersRef.current.clear();
    };
  }, []);

  // Return empty - markers are managed internally
  return {
    zoomToCluster,
  };
}
