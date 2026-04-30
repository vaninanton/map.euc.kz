import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSatellite, faMap } from '@fortawesome/free-solid-svg-icons';
import type { BaseMapStyle } from '@/hooks/useMapbox';

interface MapModeToggleProps {
  baseStyle: BaseMapStyle;
  onBaseStyleChange: (style: BaseMapStyle) => void;
}

export function MapModeToggle({ baseStyle, onBaseStyleChange }: MapModeToggleProps) {
  const isSatellite = baseStyle === 'satellite';

  return (
    <button
      type="button"
      onClick={() => {
        onBaseStyleChange(isSatellite ? 'streets' : 'satellite');
      }}
      className="fixed top-0 right-0 z-20 h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-neutral-200/80 bg-white/95 text-neutral-700 shadow-lg shadow-neutral-900/10 backdrop-blur-xl transition hover:bg-neutral-100 control-inset-top control-inset-right inline-flex items-center justify-center cursor-pointer"
      aria-label={isSatellite ? 'Переключить на карту' : 'Переключить на спутник'}
      title={isSatellite ? 'Переключить на карту' : 'Переключить на спутник'}
    >
      <span className="relative block h-6 w-6">
        <FontAwesomeIcon
          icon={faMap}
          className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ease-out ${
            isSatellite ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 -rotate-12'
          }`}
          aria-hidden
        />
        <FontAwesomeIcon
          icon={faSatellite}
          className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ease-out ${
            isSatellite ? 'opacity-0 scale-75 rotate-12' : 'opacity-100 scale-100 rotate-0'
          }`}
          aria-hidden
        />
      </span>
    </button>
  );
}
