/** Очищает localStorage, Cache API и снимает регистрацию Service Worker, затем перезагружает страницу. */
export async function resetAppCache(): Promise<void> {
    try {
        localStorage.clear()

        if ('caches' in window) {
            const names = await caches.keys()
            await Promise.all(names.map((name) => caches.delete(name)))
        }

        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations()
            await Promise.all(registrations.map((r) => r.unregister()))
        }
    } catch (error) {
        console.error('Не удалось полностью очистить кеш:', error)
    } finally {
        window.location.reload()
    }
}
