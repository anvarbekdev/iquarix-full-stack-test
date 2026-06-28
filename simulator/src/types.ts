export interface SourceRecord {
  imei: string;
  lat: number;
  long: number;
  speed: number;
  ignition: 0 | 1;
  occurred_at: string;
}

export interface TrackPoint {
  lat: number;
  long: number;
  speed: number;
  ignition: 0 | 1;
}

export interface Ping {
  vehicle_id: number;
  lat: number;
  long: number;
  speed: number;
  ignition: 0 | 1;
  occurred_at: string;
}
