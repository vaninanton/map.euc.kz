import type { LayerKey, LayerVisibility } from '@/hooks/useLayers';
import type { BaseMapStyle } from '@/hooks/useMapbox';
import { COLORS } from '@/constants';
import { TelegramChannels } from '@/components/TelegramChannels';

interface LayerControlsProps {
  visibility: LayerVisibility;
  onToggle: (layer: LayerKey) => void;
  baseStyle: BaseMapStyle;
  onBaseStyleChange: (style: BaseMapStyle) => void;
  isAddingPoint: boolean;
  onToggleAddPoint: () => void;
}

const LABELS: Record<LayerKey, string> = {
  points: 'Точки',
  sockets: 'Розетки',
  routes: 'Маршруты',
  bikeLanes: 'Велодорожки',
  telegramUsers: 'Гео из чатов',
};

const ROW_COLORS: Record<LayerKey, string> = {
  points: COLORS.point,
  sockets: COLORS.socket,
  routes: COLORS.route,
  bikeLanes: COLORS.bikeLane,
  telegramUsers: COLORS.telegramUser,
};

const LAYER_ORDER: LayerKey[] = ['points', 'routes', 'telegramUsers', 'bikeLanes', 'sockets'];

export function LayerControls({
  visibility,
  onToggle,
  baseStyle,
  onBaseStyleChange,
  isAddingPoint,
  onToggleAddPoint,
}: LayerControlsProps) {
  return (
    <div
      className="fixed bottom-0 left-0 z-10 w-[160px] sm:w-[180px] rounded-xl border border-neutral-200/80 bg-white/95 shadow-lg shadow-neutral-900/10 backdrop-blur-xl control-inset-left control-inset-bottom"
      role="group"
      aria-label="Слои карты"
    >
      <div className="flex rounded-lg overflow-hidden border-b border-neutral-200/80 mx-2 mt-2 mb-1 sm:mx-2.5 sm:mt-2.5 sm:mb-1.5">
        <button
          type="button"
          onClick={() => {
            onBaseStyleChange('streets');
          }}
          className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors ${baseStyle === 'streets' ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-100'}`}
        >
          Карта
        </button>
        <button
          type="button"
          onClick={() => {
            onBaseStyleChange('satellite');
          }}
          className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors border-l border-neutral-200/80 ${baseStyle === 'satellite' ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-100'}`}
        >
          Спутник
        </button>
      </div>
      <ul className="px-2 py-1.5 flex flex-col gap-0 sm:px-2.5 sm:py-2">
        {LAYER_ORDER.map((key) => {
          const color = ROW_COLORS[key];
          const isOn = visibility[key];
          return (
            <li key={key}>
              <label
                className="flex items-center gap-2 cursor-pointer group rounded-lg py-1.5 px-2 -mx-0.5 transition-colors hover:bg-neutral-100/80 active:bg-neutral-200/60 sm:gap-2.5 sm:py-2 sm:px-2.5"
              >
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
          className={`w-full rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition ${
            isAddingPoint
              ? 'bg-blue-600/35 text-white hover:bg-blue-700/35'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isAddingPoint ? 'Отменить' : 'Добавить точку'}
        </button>
      </div>
      <TelegramChannels />
    </div>
  );
}
