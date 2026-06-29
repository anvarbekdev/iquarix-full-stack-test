import dotenv from "dotenv";
import { loadVehicleTracks } from "./loadData";
import { Ping, TrackPoint } from "./types";

dotenv.config();

const TICK_MS = 1000;
const CYCLE_TICKS = 5;
const VEHICLE_COUNT = 10;

const BACKEND_URL = process.env.BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error("BACKEND_URL env var is required");
}

const tracks = loadVehicleTracks();

// stagger start position and tick slot per vehicle so pings don't all land in lockstep
const cursors = tracks.map((track) => Math.floor(Math.random() * track.length));
const tickSlots = tracks.map(() => Math.floor(Math.random() * CYCLE_TICKS));

let tick = 0;

function nextPoint(vehicleIndex: number): TrackPoint {
  const track = tracks[vehicleIndex];
  const point = track[cursors[vehicleIndex]];
  cursors[vehicleIndex] = (cursors[vehicleIndex] + 1) % track.length;
  return point;
}

function buildBatch(currentTick: number): Ping[] {
  const occurredAt = new Date().toISOString();
  const dueVehicles = tickSlots
    .map((slot, vehicleIndex) => ({ slot, vehicleIndex }))
    .filter(({ slot }) => currentTick % CYCLE_TICKS === slot);

  return dueVehicles.map(({ vehicleIndex }) => {
    const point = nextPoint(vehicleIndex);
    return {
      vehicle_id: vehicleIndex + 1,
      lat: point.lat,
      long: point.long,
      speed: point.speed,
      ignition: point.ignition,
      occurred_at: occurredAt,
    };
  });
}

async function postOnce(batch: Ping[]): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/pings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error(
        `POST /api/pings failed: ${res.status} ${await res.text()}`,
      );
      return false;
    }
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
    } | null;
    if (!body || body.ok !== true) {
      console.error(
        "POST /api/pings returned an unexpected response body:",
        body,
      );
      return false;
    }
    console.log(`Sent ${batch.length} pings`);
    return true;
  } catch (err) {
    console.error("POST /api/pings error:", err);
    return false;
  }
}

async function sendBatch(batch: Ping[]): Promise<void> {
  const delivered = await postOnce(batch);
  if (!delivered) {
    console.warn("Retrying failed batch once...");
    const retried = await postOnce(batch);
    if (!retried) {
      console.error("Retry failed, dropping batch.");
    }
  }
}

console.log(
  `Fleet simulator started. Posting ${VEHICLE_COUNT} vehicles to ${BACKEND_URL}, staggered across ${CYCLE_TICKS}s cycles`,
);

setInterval(() => {
  const batch = buildBatch(tick);
  tick += 1;
  if (batch.length > 0) {
    void sendBatch(batch);
  }
}, TICK_MS);
