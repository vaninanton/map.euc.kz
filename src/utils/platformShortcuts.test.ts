import { describe, it, expect, vi, afterEach } from 'vitest'
import { getUndoRedoShortcuts } from './platformShortcuts'

describe('getUndoRedoShortcuts', () => {
    const originalNavigator = globalThis.navigator

    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            value: originalNavigator,
            writable: true,
            configurable: true,
        })
    })

    it('возвращает Mac-шорткаты для macOS по userAgentData.platform', () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: { userAgentData: { platform: 'macOS' }, platform: '' },
            writable: true,
            configurable: true,
        })
        const shortcuts = getUndoRedoShortcuts()
        expect(shortcuts.undo).toBe('⌘+Z')
        expect(shortcuts.redo).toBe('⌘+Shift+Z')
    })

    it('возвращает Mac-шорткаты для iPhone по navigator.platform', () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: { platform: 'iPhone' },
            writable: true,
            configurable: true,
        })
        const shortcuts = getUndoRedoShortcuts()
        expect(shortcuts.undo).toBe('⌘+Z')
        expect(shortcuts.redo).toBe('⌘+Shift+Z')
    })

    it('возвращает Ctrl-шорткаты для Windows', () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: { platform: 'Win32' },
            writable: true,
            configurable: true,
        })
        const shortcuts = getUndoRedoShortcuts()
        expect(shortcuts.undo).toBe('Ctrl+Z')
        expect(shortcuts.redo).toBe('Ctrl+Shift+Z')
    })

    it('возвращает Ctrl-шорткаты для Linux', () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: { platform: 'Linux x86_64' },
            writable: true,
            configurable: true,
        })
        const shortcuts = getUndoRedoShortcuts()
        expect(shortcuts.undo).toBe('Ctrl+Z')
        expect(shortcuts.redo).toBe('Ctrl+Shift+Z')
    })

    it('возвращает Ctrl-шорткаты если navigator undefined', () => {
        vi.stubGlobal('navigator', undefined)
        const shortcuts = getUndoRedoShortcuts()
        expect(shortcuts.undo).toBe('Ctrl+Z')
        expect(shortcuts.redo).toBe('Ctrl+Shift+Z')
        vi.unstubAllGlobals()
    })
})
