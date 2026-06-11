import '@testing-library/jest-dom'

// localStorage и sessionStorage не определены в некоторых конфигурациях jsdom — полифиллим
if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => { store.set(k, v) },
            removeItem: (k: string) => { store.delete(k) },
            clear: () => { store.clear() },
        },
        writable: true,
        configurable: true,
    })
}

// matchMedia не реализован в jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    }),
})
