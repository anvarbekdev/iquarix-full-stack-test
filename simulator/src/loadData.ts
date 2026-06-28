import fs from "fs";
import path from "path";
import { SourceRecord, TrackPoint } from "./types";

const VEHICLE_COUNT = 10;
const BASE_VEHICLE_COUNT = 5;

function enforceIgnitionSpeedRule(point: TrackPoint): TrackPoint {
  return point.ignition === 0 ? { ...point, speed: 0 } : point;
}

function jitterSpeed(point: TrackPoint): TrackPoint {
  if (point.ignition === 0) return point;
  const factor = 0.85 + Math.random() * 0.3; // +/-15%
  return { ...point, speed: Math.round(point.speed * factor * 10) / 10 };
}

function loadBaseTracks(): TrackPoint[][] {
  const filePath = path.join(__dirname, "..", "data", "source.json");
  const raw: SourceRecord[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const byImei = new Map<string, SourceRecord[]>();
  for (const record of raw) {
    const group = byImei.get(record.imei) ?? [];
    group.push(record);
    byImei.set(record.imei, group);
  }

  const tracks = [...byImei.values()]
    .map((group) => group.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)))
    .map((group) =>
      group.map((r) =>
        enforceIgnitionSpeedRule({
          lat: r.lat,
          long: r.long,
          speed: r.speed,
          ignition: r.ignition,
        })
      )
    );

  if (tracks.length !== BASE_VEHICLE_COUNT) {
    throw new Error(
      `Expected ${BASE_VEHICLE_COUNT} base vehicles in source data, found ${tracks.length}`
    );
  }

  return tracks;
}

function deriveReversedTrack(baseTrack: TrackPoint[]): TrackPoint[] {
  return [...baseTrack].reverse().map((point) => jitterSpeed(point));
}

export function loadVehicleTracks(): TrackPoint[][] {
  const baseTracks = loadBaseTracks();
  const derivedTracks = baseTracks.map(deriveReversedTrack);
  const allTracks = [...baseTracks, ...derivedTracks];

  if (allTracks.length !== VEHICLE_COUNT) {
    throw new Error(`Expected ${VEHICLE_COUNT} vehicle tracks, built ${allTracks.length}`);
  }

  return allTracks;
}
