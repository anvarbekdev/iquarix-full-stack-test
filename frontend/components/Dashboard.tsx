'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { getVehicleTrace, getVehicles } from '@/lib/api';
import type { TraceResponse, Vehicle } from '@/types';

const MapView = dynamic(() => import('./MapView'), {
  ssr:     false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-500 text-sm">
      Loading map…
    </div>
  ),
});

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function Dashboard() {
  const [vehicles,   setVehicles]   = useState<Vehicle[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [trace,      setTrace]      = useState<TraceResponse | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const loadVehicles = useCallback(async () => {
    try {
      const data = await getVehicles();
      setVehicles(data);
      setFetchError(null);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load vehicles');
    }
  }, []);

  useEffect(() => {
    void loadVehicles();
    const id = setInterval(loadVehicles, 10_000);
    return () => clearInterval(id);
  }, [loadVehicles]);

  const handleVehicleClick = useCallback((id: number) => {
    setSelectedId(id);
    setTrace(null);
    setTraceError(null);

    const now  = new Date();
    const hour = new Date(now.getTime() - 60 * 60 * 1000);
    setTo(toLocalDatetimeValue(now.toISOString()));
    setFrom(toLocalDatetimeValue(hour.toISOString()));
  }, []);

  const handleShowTrace = useCallback(async () => {
    if (selectedId == null || !from || !to) return;
    setTraceLoading(true);
    setTraceError(null);
    try {
      const data = await getVehicleTrace(selectedId, new Date(from).toISOString(), new Date(to).toISOString());
      setTrace(data);
    } catch (e) {
      setTraceError(e instanceof Error ? e.message : 'Failed to load trace');
      setTrace(null);
    } finally {
      setTraceLoading(false);
    }
  }, [selectedId, from, to]);

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-900 text-zinc-100">
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-zinc-700 overflow-y-auto">
        <div className="px-4 py-3 border-b border-zinc-700">
          <h1 className="text-base font-semibold tracking-wide">Fleet Dashboard</h1>
          {fetchError && (
            <p className="mt-1 text-xs text-red-400">{fetchError}</p>
          )}
        </div>

        {/* Vehicle list */}
        <ul className="flex-1 divide-y divide-zinc-800">
          {vehicles.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => handleVehicleClick(v.id)}
                className={`w-full text-left px-4 py-3 transition-colors hover:bg-zinc-800 ${
                  selectedId === v.id ? 'bg-zinc-800' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      v.ignition === 1
                        ? 'bg-green-500'
                        : v.ignition === 0
                        ? 'bg-red-500'
                        : 'bg-zinc-500'
                    }`}
                  />
                  <span className="font-mono text-sm font-medium">{v.plate_number}</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-400 truncate">{v.model_name}</p>
                {v.speed != null && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {v.speed.toFixed(1)} km/h
                  </p>
                )}
                {v.lat == null && (
                  <p className="mt-0.5 text-xs text-zinc-600 italic">no data yet</p>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Trace panel */}
        {selected && (
          <div className="border-t border-zinc-700 px-4 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Trace — {selected.plate_number}
            </p>

            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">
                From
                <input
                  type="datetime-local"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-0.5 w-full rounded bg-zinc-800 border border-zinc-600 px-2 py-1.5
                             text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </label>
              <label className="block text-xs text-zinc-400">
                To
                <input
                  type="datetime-local"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-0.5 w-full rounded bg-zinc-800 border border-zinc-600 px-2 py-1.5
                             text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </label>
            </div>

            <button
              onClick={() => void handleShowTrace()}
              disabled={traceLoading || !from || !to}
              className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-medium
                         hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {traceLoading ? 'Loading…' : 'Show Trace'}
            </button>

            {traceError && (
              <p className="text-xs text-red-400">{traceError}</p>
            )}

            {trace && (
              <div className="rounded bg-zinc-800 px-3 py-2.5 space-y-1.5 text-xs">
                <p className="font-semibold text-zinc-300">
                  {trace.trace.length} points
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-zinc-400">
                  <span>Ignition cycles</span>
                  <span className="text-zinc-100 text-right">{trace.ignition_cycles}</span>
                  <span>Max speed</span>
                  <span className="text-zinc-100 text-right">{trace.max_speed.toFixed(1)} km/h</span>
                  <span>Avg speed</span>
                  <span className="text-zinc-100 text-right">{trace.avg_speed.toFixed(1)} km/h</span>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      <main className="flex-1 relative">
        <MapView
          vehicles={vehicles}
          selectedId={selectedId}
          trace={trace?.trace ?? []}
          onVehicleClick={handleVehicleClick}
        />
      </main>
    </div>
  );
}
