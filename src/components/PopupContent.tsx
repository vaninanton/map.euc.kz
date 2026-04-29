import { useEffect, useState } from 'react';
import Typograf from 'typograf';
import { FEATURE_TYPE_LABELS, POINT_FLAG_LABELS, COLORS } from '@/constants';
import { computeRouteStats } from '@/utils/routeStats';
import type { Feature } from '@/types/geojson';
import { ShareBlock } from '@/components/ShareBlock';
import { isRouteFeature } from '@/utils/mapFeatureGuards';

const typograf = new Typograf({ locale: ['ru', 'en-US'] });

interface PopupContentProps {
  feature: Feature;
  onCopied?: () => void;
}

export function PopupContent({ feature, onCopied }: PopupContentProps) {
  const { type, name, description } = feature.properties;
  const photos = feature.properties.type === 'point' || feature.properties.type === 'socket'
    ? feature.properties.photos ?? []
    : [];
  const telegramAvatarUrl = feature.properties.type === 'telegramUser'
    ? feature.properties.avatarUrl
    : null;
  const isMeeting = type === 'point' ? feature.properties.isMeeting : false;
  const hasSocket = type === 'point' ? feature.properties.hasSocket === true : false;
  const typeLabel =
    type === 'point' && isMeeting ? POINT_FLAG_LABELS.meeting : FEATURE_TYPE_LABELS[type];
  const typeColor = COLORS[type];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const activePhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;
  const [nowTs, setNowTs] = useState(() => Date.now());

  const humanizeRelativeTime = (isoDate: string): string => {
    const timestamp = Date.parse(isoDate);
    if (!Number.isFinite(timestamp)) return 'только что';
    const diffMs = Math.max(0, nowTs - timestamp);
    const sec = Math.floor(diffMs / 1000);
    if (sec < 5) return 'только что';
    if (sec < 60) return `${String(sec)} сек назад`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${String(min)} мин назад`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${String(hours)} ч назад`;
    const days = Math.floor(hours / 24);
    return `${String(days)} дн назад`;
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null);
        return;
      }
      if (event.key === 'ArrowLeft') {
        setLightboxIndex((prev) => {
          if (prev === null || photos.length === 0) return null;
          return (prev - 1 + photos.length) % photos.length;
        });
      }
      if (event.key === 'ArrowRight') {
        setLightboxIndex((prev) => {
          if (prev === null || photos.length === 0) return null;
          return (prev + 1) % photos.length;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, photos.length]);

  useEffect(() => {
    if (feature.properties.type !== 'telegramUser') return;
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [feature.properties.type]);

  let stats: { distanceKm: number; ascentM: number; descentM: number } | null = null;
  if (isRouteFeature(feature)) {
    const s = computeRouteStats(feature);
    const distanceKm =
      feature.properties.distance != null && Number.isFinite(feature.properties.distance)
        ? feature.properties.distance
        : s.distanceKm;
    stats = { distanceKm, ascentM: s.ascentM, descentM: s.descentM };
  }

  return (
    <div className="text-left">
      <div className="p-2 pb-0">
        <span
          className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
          style={{ backgroundColor: typeColor }}
        >
          {typeLabel}
        </span>
        <h3 className="font-semibold text-neutral-900 mt-2 text-[15px]">
          {name || 'Без названия'}
        </h3>
        {telegramAvatarUrl && (
          <img
            src={telegramAvatarUrl}
            alt={`Аватар ${name || 'пользователя'}`}
            className="mt-2 h-12 w-12 rounded-full border border-neutral-200 bg-neutral-50 object-cover"
            loading="lazy"
          />
        )}
        {hasSocket && (
          <span className="mt-1.5 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            Можно зарядиться
          </span>
        )}
        {description && (
          <p className="text-xs text-neutral-600 mt-1.5" dangerouslySetInnerHTML={{ __html: typograf.execute(description) }} />
        )}
        {feature.properties.type === 'telegramUser' && (
          <>
            <p className="text-xs text-neutral-500 mt-1">
              Последняя гео: {humanizeRelativeTime(feature.properties.updatedAt)}
            </p>
            {typeof feature.properties.avgSpeedKmh === 'number' && Number.isFinite(feature.properties.avgSpeedKmh) && (
              <p className="text-xs text-neutral-500 mt-0.5">
                Средняя скорость (последние точки): {feature.properties.avgSpeedKmh.toFixed(1)} км/ч
              </p>
            )}
          </>
        )}
        {photos.length > 0 && (
          <div className="mt-3 -mx-2 px-2 overflow-x-auto">
            <div className="flex gap-2 pb-1">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="block shrink-0 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100"
                >
                  <img
                    src={photo.url}
                    alt={photo.alt?.trim() || `${name || 'Точка'} — фото ${index + 1}`}
                    className="w-28 h-20 object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
        {stats && (
          <div className="flex flex-nowrap gap-2 mt-3 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              {stats.distanceKm.toFixed(1)} км
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              {Math.round(stats.ascentM)} м
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              {Math.round(stats.descentM)} м
            </span>
          </div>
        )}
      </div>
      <ShareBlock feature={feature} onCopied={onCopied} />
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фотографии"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/90 hover:text-white text-3xl leading-none"
            aria-label="Закрыть просмотр"
          >
            ×
          </button>
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxIndex((prev) => (prev === null ? null : (prev - 1 + photos.length) % photos.length));
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-4xl leading-none"
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
          )}
          <figure
            className="max-w-5xl w-full flex flex-col items-center"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={activePhoto.url}
              alt={activePhoto.alt?.trim() || `${name || 'Точка'} — фото ${(lightboxIndex ?? 0) + 1}`}
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg"
            />
            <figcaption className="mt-3 text-sm text-white/90">
              {activePhoto.alt?.trim() || `${(lightboxIndex ?? 0) + 1} из ${photos.length}`}
            </figcaption>
          </figure>
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxIndex((prev) => (prev === null ? null : (prev + 1) % photos.length));
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-4xl leading-none"
              aria-label="Следующее фото"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
