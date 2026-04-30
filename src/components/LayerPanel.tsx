import type { LayerKey, LayerVisibility } from '@/hooks/useLayers';
import { COLORS } from '@/constants';

interface LayerPanelProps {
  visibility: LayerVisibility;
  onToggle: (layer: LayerKey) => void;
  isAddingPoint: boolean;
  onToggleAddPoint: () => void;
  onOpenRiderGeoModal: () => void;
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

const LAYER_ORDER: LayerKey[] = ['points', 'routes', 'telegramUsers', 'bikeLanes', 'sockets'];

export function LayerPanel({
  visibility,
  onToggle,
  isAddingPoint,
  onToggleAddPoint,
  onOpenRiderGeoModal,
  onCollapse,
}: LayerPanelProps) {
  return (
    <div
      className="fixed bottom-0 left-0 z-10 w-[160px] sm:w-[180px] rounded-xl border border-neutral-200/80 bg-white/95 shadow-lg shadow-neutral-900/10 backdrop-blur-xl control-inset-left control-inset-bottom"
      role="group"
      aria-label="Слои карты"
    >
      <button
        type="button"
        onClick={onCollapse}
        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200/80 bg-white text-neutral-700 transition hover:bg-neutral-100 sm:h-8 sm:w-8 cursor-pointer"
        aria-label="Свернуть панель слоев"
        title="Свернуть панель слоев"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M6 6L14 14M14 6L6 14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul className="px-2 py-1.5 pt-8 mt-2 flex flex-col gap-0 sm:px-2.5 sm:py-2 sm:pt-9 sm:mt-2.5">
        {LAYER_ORDER.map((key) => {
          const color = ROW_COLORS[key];
          const isOn = visibility[key];
          return (
            <li key={key}>
              <label className="flex items-center gap-2 cursor-pointer group rounded-lg py-1.5 px-2 -mx-0.5 transition-colors hover:bg-neutral-100/80 active:bg-neutral-200/60 sm:gap-2.5 sm:py-2 sm:px-2.5">
                <span className="flex-1 text-xs sm:text-sm font-medium text-neutral-800 min-w-0">
                  {LABELS[key]}
                </span>
                <span className="relative shrink-0 w-8 h-4 sm:w-9 sm:h-5 rounded-full">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => {
                      onToggle(key);
                    }}
                    className="sr-only peer"
                  />
                  <span
                    className="absolute inset-0 rounded-full bg-neutral-200 transition-colors duration-200"
                    style={isOn ? { backgroundColor: `${color}cc` } : undefined}
                    aria-hidden
                  />
                  <span
                    className="absolute top-0.5 left-0.5 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white shadow transition-transform duration-200 ease-out peer-checked:translate-x-3 sm:peer-checked:translate-x-4"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.18)' }}
                    aria-hidden
                  />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="px-2 pb-2 sm:px-2.5">
        <button
          type="button"
          onClick={onToggleAddPoint}
          className={`w-full rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
            isAddingPoint ? 'bg-blue-600/35 text-white hover:bg-blue-700/35' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isAddingPoint ? 'Отменить' : 'Добавить точку'}
        </button>
        <button
          type="button"
          onClick={onOpenRiderGeoModal}
          className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:text-sm cursor-pointer"
        >
          Радар
        </button>
      </div>
    </div>
  );
}
