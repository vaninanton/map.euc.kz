import { useEffect, useMemo, useState } from 'react';
import type { Feature } from '@/types/geojson';

interface RiderGeoModalProps {
  riders: Feature[];
  onClose: () => void;
}

type UserPosition = {
  lat: number;
  lon: number;
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function computeDistanceKm(from: UserPosition, to: UserPosition): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function computeBearingDeg(from: UserPosition, to: UserPosition): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

function bearingToCompassRu(bearingDeg: number): string {
  const sectors = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  const index = Math.round(bearingDeg / 45) % 8;
  return sectors[index];
}

export function RiderGeoModal({ riders, onClose }: RiderGeoModalProps) {
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Геолокация недоступна в этом браузере.');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLocationError(null);
        setIsLoadingLocation(false);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Доступ к геолокации запрещён. Разрешите доступ и откройте окно снова.');
        } else {
          setLocationError('Не удалось определить ваше местоположение.');
        }
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  const riderRows = useMemo(() => {
    if (!userPosition) return [];

    return riders
      .map((feature) => {
        if (feature.geometry.type !== 'Point' || feature.properties.type !== 'telegramUser') return null;
        const [lon, lat] = feature.geometry.coordinates;
        const target = { lat, lon };
        const distanceKm = computeDistanceKm(userPosition, target);
        const bearingDeg = computeBearingDeg(userPosition, target);
        return {
          id: feature.properties.id,
          name: feature.properties.name || 'Без имени',
          distanceKm,
          bearingDeg,
          bearingLabel: bearingToCompassRu(bearingDeg),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [riders, userPosition]);

  const radarMaxDistanceKm = useMemo(() => {
    if (riderRows.length === 0) return 1;
    const maxDistance = Math.max(...riderRows.map((rider) => rider.distanceKm));
    return Math.max(maxDistance, 0.2);
  }, [riderRows]);

  const radarPoints = useMemo(() => {
    const radarRadius = 120;
    return riderRows.map((rider) => {
      const normalizedDistance = Math.min(1, rider.distanceKm / radarMaxDistanceKm);
      const angleRad = toRadians(rider.bearingDeg - 90);
      const pointRadius = normalizedDistance * radarRadius;
      const x = Math.cos(angleRad) * pointRadius;
      const y = Math.sin(angleRad) * pointRadius;
      return {
        ...rider,
        x,
        y,
      };
    });
  }, [riderRows, radarMaxDistanceKm]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Расстояние до райдеров">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">Расстояние и направление до райдеров</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
          {isLoadingLocation && <p className="text-sm text-neutral-600">Определяю ваше местоположение...</p>}

          {!isLoadingLocation && locationError && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{locationError}</p>
          )}

          {!isLoadingLocation && !locationError && riderRows.length === 0 && (
            <p className="text-sm text-neutral-600">Нет доступных геопозиций райдеров.</p>
          )}

          {!isLoadingLocation && !locationError && riderRows.length > 0 && (
            <div>
              <div className="mb-2 text-xs text-neutral-500">
                Центр радара — ваша геопозиция. Внешний круг: {radarMaxDistanceKm.toFixed(2)} км
              </div>

              <div className="flex justify-center">
                <svg width="280" height="280" viewBox="-140 -140 280 280" role="img" aria-label="Радар райдеров">
                  <circle cx="0" cy="0" r="120" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                  <circle cx="0" cy="0" r="80" fill="none" stroke="#dbe4ee" strokeWidth="1" />
                  <circle cx="0" cy="0" r="40" fill="none" stroke="#dbe4ee" strokeWidth="1" />
                  <line x1="-120" y1="0" x2="120" y2="0" stroke="#dbe4ee" strokeWidth="1" />
                  <line x1="0" y1="-120" x2="0" y2="120" stroke="#dbe4ee" strokeWidth="1" />

                  <text x="0" y="-127" textAnchor="middle" className="fill-neutral-500 text-[10px]">С</text>
                  <text x="127" y="4" textAnchor="middle" className="fill-neutral-500 text-[10px]">В</text>
                  <text x="0" y="135" textAnchor="middle" className="fill-neutral-500 text-[10px]">Ю</text>
                  <text x="-127" y="4" textAnchor="middle" className="fill-neutral-500 text-[10px]">З</text>

                  <circle cx="0" cy="0" r="4" fill="#111827" />

                  {radarPoints.map((rider) => (
                    <g key={rider.id}>
                      <circle cx={rider.x} cy={rider.y} r="5" fill="#7c3aed" />
                      <title>
                        {rider.name}: {rider.distanceKm.toFixed(2)} км, {rider.bearingLabel} ({Math.round(rider.bearingDeg)}°)
                      </title>
                    </g>
                  ))}
                </svg>
              </div>

              <ul className="mt-3 space-y-1.5">
                {riderRows.map((rider) => (
                  <li key={rider.id} className="text-xs text-neutral-700">
                    {rider.name}: {rider.distanceKm.toFixed(2)} км · {rider.bearingLabel} ({Math.round(rider.bearingDeg)}°)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
