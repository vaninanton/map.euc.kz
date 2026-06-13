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
            aria-label="Открыть информацию"
            title="О проекте"
            className="cursor-pointer"
        >
            <FontAwesomeIcon icon={faQuestion} aria-hidden />
        </button>
    )
}
