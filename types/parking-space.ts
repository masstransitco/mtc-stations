/**
 * TypeScript types for non-metered parking spaces
 */

export type VehicleType = 'A' | 'C' | 'D'; // A = Any, C = Coach, D = Disabled
export type OccupancyStatus = 'V' | 'O' | 'NU'; // V = Vacant, O = Occupied, NU = Not Updated

/**
 * Parking space with current occupancy status and location data
 * Returned by /api/parking-spaces endpoint
 */
export interface ParkingSpace {
  feature_id: number;
  parking_space_id: string;
  latitude: number;
  longitude: number;

  // Location (English)
  district: string;
  sub_district: string;
  street: string;
  section_of_street: string;

  // Location (Traditional Chinese)
  district_tc: string;
  sub_district_tc: string;
  street_tc: string;
  section_of_street_tc: string;

  // Location (Simplified Chinese) - optional as not always used in UI
  district_sc?: string;
  sub_district_sc?: string;
  street_sc?: string;
  section_of_street_sc?: string;

  // Occupancy data
  vehicle_type: VehicleType;
  occupancy_status: OccupancyStatus;
  is_vacant: boolean;
  occupancy_date_changed: string | null;
  is_stale: boolean;
}

/**
 * Static parking space info (from GeoJSON)
 */
export interface ParkingSpaceInfo {
  feature_id: number;
  parking_space_id: string;
  latitude: number;
  longitude: number;
  region: string;
  region_tc: string;
  region_sc: string;
  district: string;
  district_tc: string;
  district_sc: string;
  sub_district: string;
  sub_district_tc: string;
  sub_district_sc: string;
  street: string;
  street_tc: string;
  street_sc: string;
  section_of_street: string;
  section_of_street_tc: string;
  section_of_street_sc: string;
  vehicle_type: VehicleType;
}

/**
 * Occupancy statistics by district
 */
export interface ParkingSpaceStats {
  district: string;
  district_tc: string;
  vehicle_type: VehicleType;
  total_spaces: number;
  vacant_spaces: number;
  occupied_spaces: number;
  vacancy_rate: number;
}
