export interface Vehicle {
  id:           number;
  plate_number: string;
  model_name:   string;
  lat:          number | null;
  lng:          number | null;
  speed:        number | null;
  ignition:     number | null;
  occurred_at:  string | null;
}

export interface TracePoint {
  lat:         number;
  lng:         number;
  speed:       number;
  ignition:    number;
  occurred_at: string;
}

export interface TraceResponse {
  vehicle_id:      number;
  trace:           TracePoint[];
  ignition_cycles: number;
  max_speed:       number;
  avg_speed:       number;
}
