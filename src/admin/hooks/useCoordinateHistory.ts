import { useCallback, useRef } from 'react'

/** История координат для Ctrl+Z / Ctrl+Shift+Z (без привязки к полям ввода текста). */
export function useCoordinateHistory<T>() {
    const undoStack = useRef<string[]>([])
    const redoStack = useRef<string[]>([])

    const reset = useCallback(() => {
        undoStack.current = []
        redoStack.current = []
    }, [])

    /** Перед заменой координат сохранить предыдущее состояние и сбросить redo. */
    const prepareCommit = useCallback((previous: T) => {
        undoStack.current.push(JSON.stringify(previous))
        redoStack.current = []
    }, [])

    const undo = useCallback((current: T): T | null => {
        if (undoStack.current.length === 0) return null
        const raw = undoStack.current.pop()
        if (raw === undefined) return null
        redoStack.current.push(JSON.stringify(current))
        return JSON.parse(raw) as T
    }, [])

    const redo = useCallback((current: T): T | null => {
        if (redoStack.current.length === 0) return null
        const raw = redoStack.current.pop()
        if (raw === undefined) return null
        undoStack.current.push(JSON.stringify(current))
        return JSON.parse(raw) as T
    }, [])

    return { reset, prepareCommit, undo, redo }
}

export function isUndoRedoBlockedTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}
