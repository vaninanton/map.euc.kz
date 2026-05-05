export interface UndoRedoShortcuts {
    undo: string
    redo: string
}

function isApplePlatform(): boolean {
    if (typeof navigator === 'undefined') return false

    const navWithUaData = navigator as Navigator & { userAgentData?: { platform?: string } }
    const uaPlatform = navWithUaData.userAgentData?.platform
    if (typeof uaPlatform === 'string' && /(mac|iphone|ipad|ipod)/i.test(uaPlatform)) return true

    return /(mac|iphone|ipad|ipod)/i.test(navigator.platform)
}

/** Подписи клавиш для текущей платформы пользователя. */
export function getUndoRedoShortcuts(): UndoRedoShortcuts {
    if (isApplePlatform()) {
        return { undo: '⌘+Z', redo: '⌘+Shift+Z' }
    }
    return { undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z' }
}
