import { useEffect } from 'react'
import { isUndoRedoBlockedTarget } from '@/admin/hooks/useCoordinateHistory'

/** Глобальные Ctrl/Cmd+Z и Ctrl/Cmd+Shift+Z вне полей ввода. */
export function useUndoRedoHotkeys(params: { onUndo: () => void; onRedo: () => void }) {
    const { onUndo, onRedo } = params
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return
            if (event.key.toLowerCase() !== 'z') return
            if (isUndoRedoBlockedTarget(event.target)) return
            event.preventDefault()
            if (event.shiftKey) {
                onRedo()
            } else {
                onUndo()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [onUndo, onRedo])
}
