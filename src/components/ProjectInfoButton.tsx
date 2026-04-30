import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestion } from '@fortawesome/free-solid-svg-icons'

interface ProjectInfoButtonProps {
    onClick: () => void
}

export function ProjectInfoButton({ onClick }: ProjectInfoButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="fixed right-0 bottom-0 z-20 h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-neutral-200/80 bg-white/95 text-neutral-700 shadow-lg shadow-neutral-900/10 backdrop-blur-xl transition hover:bg-neutral-100 control-inset-right control-inset-bottom inline-flex items-center justify-center cursor-pointer"
            aria-label="Открыть информацию"
            title="О проекте"
        >
            <FontAwesomeIcon icon={faQuestion} className="h-4 w-4" aria-hidden />
        </button>
    )
}
