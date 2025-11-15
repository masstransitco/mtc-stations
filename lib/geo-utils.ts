import { Vector3 } from 'three';

const EARTH_RADIUS_METERS = 6371008.8;

// Math shorthands
const { sin, cos, log, tan, PI } = Math;
const degToRad = (deg: number) => (deg * PI) / 180;

export interface LatLngAltitudeLiteral {
  lat: number;
  lng: number;
  altitude?: number;
}

/**
 * Converts WGS84 latitude and longitude to WebMercator (EPSG:3857) meters.
 * This matches Google Maps' coordinate system.
 */
function latLngToWebMercator(position: google.maps.LatLngLiteral): { x: number; y: number } {
  const x = EARTH_RADIUS_METERS * degToRad(position.lng);
  const y = EARTH_RADIUS_METERS * log(tan(PI * 0.25 + 0.5 * degToRad(position.lat)));
  return { x, y };
}

/**
 * Converts a point given in lat/lng or lat/lng/altitude-format to world-space coordinates.
 * Uses WebMercator projection to match Google Maps WebGL overlay coordinate system.
 *
 * This is the CORRECT way to transform geographic coordinates to 3D space for Google Maps.
 *
 * @param point - The geographic point to convert
 * @param reference - The anchor/reference point (typically map center)
 * @param target - Optional target to write the result to
 */
export function latLngAltToVector3(
  point: LatLngAltitudeLiteral | google.maps.LatLngLiteral,
  reference: LatLngAltitudeLiteral,
  target: Vector3 = new Vector3()
): Vector3 {
  // Convert both points to WebMercator coordinates
  const pointMercator = latLngToWebMercator(point);
  const referenceMercator = latLngToWebMercator(reference);

  // Calculate relative position in WebMercator meters
  const dx = pointMercator.x - referenceMercator.x;
  const dy = pointMercator.y - referenceMercator.y;

  // Apply the spherical mercator scale-factor for the reference latitude
  // This corrects for the distortion at different latitudes
  const scaleFactor = cos(degToRad(reference.lat));

  const altitude = (point as LatLngAltitudeLiteral).altitude ?? 0;

  return target.set(dx * scaleFactor, dy * scaleFactor, altitude);
}
