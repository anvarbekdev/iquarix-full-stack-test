import type { TraceResponse, Vehicle } from '@/types';

const BASE = ''; 

export async function getVehicles(): Promise<Vehicle[]> {
  const res = await fetch(`${BASE}/api/vehicles`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch vehicles: ${res.status}`);
  return res.json() as Promise<Vehicle[]>;
}

export async function getVehicleTrace(
  vehicleId: number,
  from: string,
  to: string,
): Promise<TraceResponse> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`${BASE}/api/vehicles/${vehicleId}/pings?${params}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<TraceResponse>;
}
