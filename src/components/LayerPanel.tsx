import { Link } from 'react-router-dom';
import type { LayerKey, LayerVisibility } from '@/hooks/useLayers';
import { COLORS } from '@/constants';

interface LayerPanelProps {
  visibility: LayerVisibility;
  onToggle: (layer: LayerKey) => void;
  onCollapse: () => void;
}

const LABELS: Record<LayerKey, string> = {
  points: 'Точки',
  sockets: 'Розетки',
  routes: 'Маршруты',
  bikeLanes: 'Велодорожки',
  telegramUsers: 'Геопозиции',
};

const ROW_COLORS: Record<LayerKey, string> = {
  points: COLORS.point,
  sockets: COLORS.socket,
  routes: COLORS.route,
  bikeLanes: COLORS.bikeLane,
  telegramUsers: COLORS.telegramUser,
};

const LAYER_ORDER: LayerKey[] = ['points', 'routes', 'bikeLanes', 'sockets', 'telegramUsers'];

export function LayerPanel({
  visibility,
  onToggle,
  onCollapse,
}: LayerPanelProps) {
  return (
    <div
      role="group"
      aria-label="Слои карты"
      className="relative min-w-[180px] p-6"
    >
      <button
        type="button"
        onClick={onCollapse}
        className="absolute -right-2.5 -top-2.5 flex! h-8! w-8! min-h-0! min-w-0! rounded-full! border-2! border-white! bg-neutral-100! p-0! items-center! justify-center! leading-none text-neutral-700 shadow-md transition hover:bg-neutral-200! cursor-pointer"
        aria-label="Закрыть панель слоев"
        title="Закрыть панель слоев"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden>
          <path
            d="M6 6L14 14M14 6L6 14"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul className="space-y-2">
        {LAYER_ORDER.map((key) => {
          const color = ROW_COLORS[key];
          const isOn = visibility[key];
          return (
            <li key={key}>
              <label className="flex items-center justify-between gap-3 text-[13px] text-neutral-800 cursor-pointer">
                <span className="flex-1 text-neutral-800">{LABELS[key]}</span>
                <span className="inline-flex items-center gap-2">
                  <span className="relative inline-flex h-5 w-9 items-center">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => {
                        onToggle(key);
                      }}
                      className="peer sr-only"
                    />
                    <span
                      className="absolute inset-0 rounded-full bg-neutral-200 transition-colors"
                      style={isOn ? { backgroundColor: `${color}cc` } : undefined}
                      aria-hidden
                    />
                    <span
                      className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4"
                      aria-hidden
                    />
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 border-t border-neutral-200 pt-3">
        <Link
          to="/admin"
          className="text-[12px] text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline"
        >
          Админка
        </Link>
      </div>
    </div>
  );
}
