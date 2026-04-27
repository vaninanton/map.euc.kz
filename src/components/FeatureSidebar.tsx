import type { Feature } from '@/types/geojson';
import { PopupContent } from '@/components/PopupContent';

interface FeatureSidebarProps {
  feature: Feature;
  onClose: () => void;
}

export function FeatureSidebar({ feature, onClose }: FeatureSidebarProps) {
  return (
    <aside
      className="fixed z-20 flex flex-col bg-white shadow-lg border-neutral-200/80 overflow-hidden
        bottom-0 left-0 right-0 max-h-[45vh] rounded-t-2xl border-t
        md:bottom-0 md:top-0 md:left-auto md:right-0 md:max-h-none md:w-[320px] md:max-w-[90vw] md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l md:control-inset-right md:control-inset-top md:control-inset-bottom"
      role="dialog"
      aria-label="Информация об объекте"
    >
      <div className="flex items-center justify-between shrink-0 px-4 py-2.5 border-b border-neutral-200/80 bg-neutral-50/80">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Подробности
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 -m-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"
          aria-label="Закрыть"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="overflow-y-auto min-h-0 flex-1 px-4 py-3">
        <PopupContent feature={feature} />
      </div>
    </aside>
  );
}
