/**
 * PMTiles Web Worker
 *
 * Handles tile decoding and geometry preprocessing off the main thread.
 * Receives tile buffers from the main thread and returns processed building data.
 */

import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';

export interface WorkerRequest {
  type: 'DECODE_TILE' | 'DECODE_PEDESTRIAN_TILE';
  z: number;
  x: number;
  y: number;
  buffer: ArrayBuffer;
}

export interface BuildingData {
  // Lat/lng coordinates (already converted from MVT tile space)
  coordinates: Array<[number, number]>;
  // Building properties
  height: number;
  color: string;
  // Centroid for positioning
  centerLat: number;
  centerLng: number;
}

export interface PedestrianLineData {
  // Lat/lng coordinates for the line path
  coordinates: Array<[number, number]>;
  // Styling properties
  color: string;
  widthMeters: number;
  // Feature attributes
  featureType: string;
  wheelchair: boolean;
  weatherProtected: boolean;
  gradient?: number;
  accessWindow?: string;
  floorName?: string;
  buildingName?: string;
  distancePost?: string;
}

export interface WorkerResponse {
  type: 'TILE_DECODED' | 'PEDESTRIAN_TILE_DECODED';
  tileKey: string;
  buildings?: BuildingData[];
  pedestrianLines?: PedestrianLineData[];
  error?: string;
}

/**
 * Convert tile coordinates to lat/lng bounds
 */
function tileToBounds(x: number, y: number, z: number) {
  const n = Math.pow(2, z);
  const minLng = (x / n) * 360 - 180;
  const maxLng = ((x + 1) / n) * 360 - 180;
  const latRad1 = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const latRad2 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
  const maxLat = latRad1 * 180 / Math.PI;
  const minLat = latRad2 * 180 / Math.PI;
  return { minLng, minLat, maxLng, maxLat };
}

/**
 * Process a single MVT feature into building data
 */
function processMVTFeature(
  feature: any,
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  extent: number
): BuildingData | null {
  const properties = feature.properties;
  const height = properties.height_m || 10;
  const color = properties.color || '#cccccc';

  // Get geometry (MVT coordinates are in tile space 0-extent)
  const geometry = feature.loadGeometry();

  if (!geometry || geometry.length === 0) {
    return null;
  }

  // First ring (outer)
  const ring = geometry[0];

  if (ring.length < 3) {
    return null;
  }

  // Calculate scaling factors for this tile
  const lngScale = (bounds.maxLng - bounds.minLng) / extent;
  const latScale = (bounds.maxLat - bounds.minLat) / extent;

  // Convert to lat/lng coordinates
  const coordinates: Array<[number, number]> = ring.map((pt: any) => {
    const lng = bounds.minLng + pt.x * lngScale;
    const lat = bounds.maxLat - pt.y * latScale; // Flip Y axis
    return [lng, lat];
  });

  // Calculate centroid
  let centerLat = 0;
  let centerLng = 0;
  coordinates.forEach(([lng, lat]) => {
    centerLng += lng;
    centerLat += lat;
  });
  centerLat /= coordinates.length;
  centerLng /= coordinates.length;

  return {
    coordinates,
    height,
    color,
    centerLat,
    centerLng,
  };
}

/**
 * Process a single MVT LineString feature into pedestrian line data
 */
function processPedestrianFeature(
  feature: any,
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  extent: number
): PedestrianLineData | null {
  const properties = feature.properties;

  // Get geometry (LineString)
  const geometry = feature.loadGeometry();

  if (!geometry || geometry.length === 0) {
    return null;
  }

  // LineString should have one array of points
  const line = geometry[0];

  if (line.length < 2) {
    return null;
  }

  // Calculate scaling factors for this tile
  const lngScale = (bounds.maxLng - bounds.minLng) / extent;
  const latScale = (bounds.maxLat - bounds.minLat) / extent;

  // Convert to lat/lng coordinates
  const coordinates: Array<[number, number]> = line.map((pt: any) => {
    const lng = bounds.minLng + pt.x * lngScale;
    const lat = bounds.maxLat - pt.y * latScale; // Flip Y axis
    return [lng, lat];
  });

  // Determine color based on feature type
  const featureType = properties.FeatureTyp || properties.feature_type || 'unknown';
  let color = '#4a90e2'; // Default blue

  // Color coding by feature type
  if (featureType.includes('Footbridge') || featureType.includes('footbridge')) {
    color = '#f59e0b'; // Orange for footbridges
  } else if (featureType.includes('Subway') || featureType.includes('subway') || featureType.includes('Underground')) {
    color = '#8b5cf6'; // Purple for underground
  } else if (featureType.includes('Indoor') || featureType.includes('indoor')) {
    color = '#10b981'; // Green for indoor
  }

  // Width based on wheelchair accessibility
  const wheelchair = properties.Wheelchair === 'Y' || properties.wheelchair === true;
  const widthMeters = wheelchair ? 2.5 : 1.5;

  // Weather protection
  const weatherProtected = properties.WeatherPro === 'Y' || properties.weather_protected === true;

  return {
    coordinates,
    color,
    widthMeters,
    featureType,
    wheelchair,
    weatherProtected,
    gradient: properties.Gradient || properties.gradient,
    accessWindow: properties.AccessTime || properties.access_window,
    floorName: properties.floor_name,
    buildingName: properties.building_name,
    distancePost: properties.distance_post,
  };
}

/**
 * Main message handler
 */
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { type, z, x, y, buffer } = event.data;

  if (type !== 'DECODE_TILE' && type !== 'DECODE_PEDESTRIAN_TILE') {
    return;
  }

  const tileKey = `${z}/${x}/${y}`;

  try {
    // Decode the Mapbox Vector Tile
    const pbf = new Pbf(new Uint8Array(buffer));
    const tile = new VectorTile(pbf);

    // Handle building tiles
    if (type === 'DECODE_TILE') {
      // Get the buildings layer
      const buildingsLayer = tile.layers['buildings'];

      if (!buildingsLayer) {
        // No buildings in this tile
        const response: WorkerResponse = {
          type: 'TILE_DECODED',
          tileKey,
          buildings: [],
        };
        self.postMessage(response);
        return;
      }

      // Get tile bounds for coordinate conversion
      const bounds = tileToBounds(x, y, z);
      const extent = 4096; // MVT standard extent

      // Process all buildings in this tile
      const buildings: BuildingData[] = [];
      for (let i = 0; i < buildingsLayer.length; i++) {
        try {
          const feature = buildingsLayer.feature(i);
          const buildingData = processMVTFeature(feature, bounds, extent);
          if (buildingData) {
            buildings.push(buildingData);
          }
        } catch (error) {
          console.warn(`Worker: Failed to process building ${i} in tile ${tileKey}:`, error);
        }
      }

      // Send processed data back to main thread
      const response: WorkerResponse = {
        type: 'TILE_DECODED',
        tileKey,
        buildings,
      };
      self.postMessage(response);
    }

    // Handle pedestrian network tiles
    else if (type === 'DECODE_PEDESTRIAN_TILE') {
      // Get the pedestrian layer
      const pedestrianLayer = tile.layers['pedestrian'];

      if (!pedestrianLayer) {
        // No pedestrian lines in this tile
        const response: WorkerResponse = {
          type: 'PEDESTRIAN_TILE_DECODED',
          tileKey,
          pedestrianLines: [],
        };
        self.postMessage(response);
        return;
      }

      // Get tile bounds for coordinate conversion
      const bounds = tileToBounds(x, y, z);
      const extent = 4096; // MVT standard extent

      // Process all pedestrian lines in this tile
      const pedestrianLines: PedestrianLineData[] = [];
      for (let i = 0; i < pedestrianLayer.length; i++) {
        try {
          const feature = pedestrianLayer.feature(i);
          const lineData = processPedestrianFeature(feature, bounds, extent);
          if (lineData) {
            pedestrianLines.push(lineData);
          }
        } catch (error) {
          console.warn(`Worker: Failed to process pedestrian line ${i} in tile ${tileKey}:`, error);
        }
      }

      // Send processed data back to main thread
      const response: WorkerResponse = {
        type: 'PEDESTRIAN_TILE_DECODED',
        tileKey,
        pedestrianLines,
      };
      self.postMessage(response);
    }
  } catch (error) {
    // Send error back to main thread
    const response: WorkerResponse = {
      type: type === 'DECODE_TILE' ? 'TILE_DECODED' : 'PEDESTRIAN_TILE_DECODED',
      tileKey,
      buildings: type === 'DECODE_TILE' ? [] : undefined,
      pedestrianLines: type === 'DECODE_PEDESTRIAN_TILE' ? [] : undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(response);
  }
});

// Export empty object to make this a module
export {};
