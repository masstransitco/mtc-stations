export interface IndoorFloor {
  ordinal: number;
  short_name: string;
  name: string;
}

export interface ConnectedCarpark {
  park_id: string;
  name: string;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  has_indoor_map: boolean;
  indoor_floors: IndoorFloor[] | null;
}
