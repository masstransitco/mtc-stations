/**
 * Hong Kong Government Parking Vacancy API Types
 * Based on Parking Vacancy Data Specification v1.2
 */

// Vehicle types supported by the API
export type VehicleType = 'privateCar' | 'LGV' | 'HGV' | 'CV' | 'coach' | 'motorCycle';

/**
 * Vacancy Type Semantics - Critical for proper interpretation
 *
 * Type A - Actual number:
 *   - vacancy >= 0: Actual numeric count of available spaces
 *   - vacancy = 0: Car park full (滿)
 *   - vacancy = -1: No data provided by car park operator (OFFLINE/UNKNOWN)
 *
 * Type B - Availability flag (no actual number):
 *   - vacancy = 0: Car park full (滿)
 *   - vacancy = 1: Spaces available (有車位)
 *   - vacancy = -1: No data provided (OFFLINE/UNKNOWN)
 *
 * Type C - Car park closed:
 *   - vacancy always 0 (關閉)
 *
 * IMPORTANT: Based on API Review findings, approximately 37% of records have
 * vacancy = -1 (offline/unknown). These should be filtered out for most use cases.
 */
export type VacancyType = 'A' | 'B' | 'C';

/**
 * Vacancy Category
 * Note: API Review indicates only HOURLY is commonly present in real data
 */
export type VacancyCategory = 'HOURLY' | 'DAILY' | 'MONTHLY';

/**
 * Parking Vacancy Data (from data=vacancy API call)
 */
export interface VacancyRecord {
  vacancy_type: VacancyType;
  /**
   * Number of available spaces
   * - For Type A: actual count (>= 0) or -1 (offline)
   * - For Type B: 0 (full), 1 (available), or -1 (offline)
   * - For Type C: always 0 (closed)
   *
   * WARNING: vacancy = -1 means "no data available" - these records
   * should typically be filtered out. See API Review findings.
   */
  vacancy: number;
  vacancyDIS?: number;  // Disabled spaces available
  vacancyEV?: number;   // EV charging spaces available
  vacancyUNL?: number;  // Unloading spaces available
  lastupdate: string;   // YYYY-MM-DD HH:MM:SS (from car park operator)
  category?: VacancyCategory;
}

export interface CarparkVacancy {
  park_Id: string;
  privateCar?: VacancyRecord[];
  LGV?: VacancyRecord[];
  HGV?: VacancyRecord[];
  CV?: VacancyRecord[];
  coach?: VacancyRecord[];
  motorCycle?: VacancyRecord[];
}

export interface VacancyApiResponse {
  results: CarparkVacancy[];
}

/**
 * Database schema for storing vacancy snapshots
 */
export interface ParkingVacancySnapshot {
  id?: number;
  park_id: string;
  vehicle_type: VehicleType;
  vacancy_type: VacancyType;
  vacancy: number;
  vacancy_dis: number | null;
  vacancy_ev: number | null;
  vacancy_unl: number | null;
  category: VacancyCategory | null;
  lastupdate: string;  // From API
  ingested_at?: string; // When we ingested it
  created_at?: string;  // Database timestamp
}

/**
 * Basic Car Park Information (from data=info API call)
 * Simplified for our use case - we mainly need vacancy data
 */
export interface CarparkInfo {
  park_Id: string;
  name: string;
  displayAddress: string;
  latitude: number;
  longitude: number;
  district?: string;
  nature?: 'government' | 'commercial';
  carpark_Type?: 'multi-storey' | 'off-street' | 'metered';
  opening_status?: 'OPEN' | 'CLOSED';
  contactNo?: string;
  website?: string;
}
