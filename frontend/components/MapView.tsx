'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TracePoint, Vehicle } from '@/types';

function createVehicleIcon(vehicleId: number, ignition: number | null) {
  const bg =
    ignition === 1 ? '#16a34a' :
    ignition === 0 ? '#dc2626' :
    '#6b7280';

  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${bg};border:2.5px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:11px;font-weight:700;font-family:monospace;
    ">${vehicleId}</div>`,
    iconSize:    [32, 32],
    iconAnchor:  [16, 16],
    popupAnchor: [0, -20],
  });
}

interface MapViewProps {
  vehicles:       Vehicle[];
  selectedId:     number | null;
  trace:          TracePoint[];
  onVehicleClick: (id: number) => void;
}

export default function MapView({ vehicles, selectedId, trace, onVehicleClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<Map<number, L.Marker>>(new Map());
  const polylineRef  = useRef<L.Polyline | null>(null);
  const didFitRef    = useRef(false);
  const onClickRef   = useRef(onVehicleClick);
  onClickRef.current = onVehicleClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, { center: [0, 0], zoom: 2 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current   = null;
      polylineRef.current = null;
      markersRef.current.clear();
      didFitRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove stale markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const bounds: [number, number][] = [];

    vehicles.forEach((v) => {
      if (v.lat == null || v.lng == null) return;
      bounds.push([v.lat, v.lng]);

      const marker = L.marker([v.lat, v.lng], {
        icon: createVehicleIcon(v.id, v.ignition),
      })
        .addTo(map)
        .on('click', () => onClickRef.current(v.id))
        .bindPopup(
          `<strong>${v.plate_number}</strong><br/>${v.model_name}` +
          (v.speed != null
            ? `<br/>${v.speed.toFixed(1)} km/h &middot; ignition ${v.ignition === 1 ? 'ON' : 'OFF'}`
            : ''),
        );

      markersRef.current.set(v.id, marker);
    });

    if (!didFitRef.current && bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
      didFitRef.current = true;
    }
  }, [vehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    polylineRef.current?.remove();
    polylineRef.current = null;

    if (selectedId != null && trace.length > 1) {
      polylineRef.current = L.polyline(
        trace.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#3b82f6', weight: 3, opacity: 0.85 },
      ).addTo(map);

      map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [selectedId, trace]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
