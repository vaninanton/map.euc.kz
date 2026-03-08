import Typograf from 'typograf';
import { FEATURE_TYPE_LABELS, POINT_FLAG_LABELS, COLORS } from '@/constants';
import { computeRouteStats } from '@/utils/routeStats';
import type { Feature, LineStringFeature } from '@/types/geojson';
import { ShareBlock } from '@/components/ShareBlock';

const typograf = new Typograf({ locale: ['ru', 'en-US'] });

interface PopupContentProps {
  feature: Feature;
  onCopied?: () => void;
}

export function PopupContent({ feature, onCopied }: PopupContentProps) {
  const { type, name, description, isMeeting } = feature.properties;
  const typeLabel = type === 'point' && isMeeting ? POINT_FLAG_LABELS.meeting : FEATURE_TYPE_LABELS[type] ?? type;
  const typeColor = COLORS[type] ?? COLORS.point;

  let stats: { distanceKm: number; ascentM: number; descentM: number } | null = null;
  if (feature.geometry.type === 'LineString' && type === 'route') {
    const s = computeRouteStats(feature as LineStringFeature);
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
        {description && (
          <p className="text-xs text-neutral-600 mt-1.5" dangerouslySetInnerHTML={{ __html: typograf.execute(description) }} />
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
    </div>
  );
}
