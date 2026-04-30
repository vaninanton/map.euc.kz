import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationCrosshairs } from '@fortawesome/free-solid-svg-icons';

interface LocateUserButtonProps {
  onLocateUser: () => void;
  isLocatingUser: boolean;
}

export function LocateUserButton({ onLocateUser, isLocatingUser }: LocateUserButtonProps) {
  return (
    <button
      type="button"
      onClick={onLocateUser}
      disabled={isLocatingUser}
      className="fixed right-0 top-1/2 z-20 h-10 w-10 sm:h-11 sm:w-11 -translate-y-1/2 rounded-xl border border-neutral-200/80 bg-white/95 text-neutral-700 shadow-lg shadow-neutral-900/10 backdrop-blur-xl transition hover:bg-neutral-100 control-inset-right inline-flex items-center justify-center cursor-pointer disabled:cursor-wait disabled:opacity-70"
      aria-label="Показать мою геопозицию"
      title="Показать мою геопозицию"
    >
      <FontAwesomeIcon
        icon={faLocationCrosshairs}
        className={`h-4 w-4 ${isLocatingUser ? 'animate-pulse' : ''}`}
        aria-hidden
      />
    </button>
  );
}
