export type VehicleType = 'A' | 'C' | 'G';
export type MeterStatus = 'N' | 'NU';
export type OccupancyStatus = 'O' | 'V';

export interface MeteredCarpark {
  carpark_id: string;
  name: string;
  name_tc: string;
  district: string;
  district_tc: string;
  latitude: number;
  longitude: number;
  total_spaces: number;
  tracked_spaces: number;
  spaces_with_data: number;
  vacant_spaces: number;
  occupied_spaces: number;
  vacancy_rate: number;
  last_updated: string | null;
}

export interface MeteredSpace {
  parking_space_id: string;
  carpark_id: string;
  pole_id: number;
  latitude: number;
  longitude: number;
  vehicle_type: VehicleType;
  longest_parking_period: number;
  operating_period: string;
  time_unit: number;
  payment_unit: number;
  has_real_time_tracking: boolean;
}

export interface MeteredOccupancySnapshot {
  id: number;
  parking_space_id: string;
  meter_status: MeterStatus;
  occupancy_status: OccupancyStatus;
  occupancy_date_changed: string | null;
  ingested_at: string;
  is_valid: boolean;
  is_vacant: boolean;
}
