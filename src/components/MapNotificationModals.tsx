interface MapNotificationModalsProps {
    errorMessage: string | null
    emptyMessage: string | null
    loading: boolean
    draftSubmitSuccess: string | null
    locationErrorMessage: string | null
    isResettingCache: boolean
    onResetCacheAndReload: () => void
    onCloseLocationError: () => void
}

export function MapNotificationModals({
    errorMessage,
    emptyMessage,
    loading,
    draftSubmitSuccess,
    locationErrorMessage,
    isResettingCache,
    onResetCacheAndReload,
    onCloseLocationError,
}: MapNotificationModalsProps) {
    /** Нельзя совмещать left-1/2 + translate с overlay-safe-inset: у того задан left, баннер уезжает вбок. */
    const bannerOuter =
        'pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))]'
    const bannerInner =
        'pointer-events-auto flex w-full max-w-2xl min-w-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-md'

    return (
        <>
            {errorMessage && (
                <div className={bannerOuter}>
                    <div className={`${bannerInner} bg-red-50 text-red-700`}>
                        <span className="min-w-0 text-pretty">{errorMessage}</span>
                        <button
                            type="button"
                            onClick={onResetCacheAndReload}
                            disabled={isResettingCache}
                            className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                        >
                            Обновить страницу
                        </button>
                    </div>
                </div>
            )}
            {!errorMessage && !loading && emptyMessage && (
                <div className={bannerOuter}>
                    <div className={`${bannerInner} bg-amber-50 text-amber-700`}>
                        <span className="min-w-0 text-pretty">{emptyMessage}</span>
                    </div>
                </div>
            )}
            {draftSubmitSuccess && (
                <div className={bannerOuter}>
                    <div className={`${bannerInner} bg-emerald-50 text-emerald-700`}>
                        <span className="min-w-0 text-pretty">{draftSubmitSuccess}</span>
                    </div>
                </div>
            )}
            {locationErrorMessage && (
                <div className={bannerOuter}>
                    <div className={`${bannerInner} bg-amber-50 text-amber-700`}>
                        <span className="min-w-0 text-pretty">{locationErrorMessage}</span>
                        <button
                            type="button"
                            onClick={onCloseLocationError}
                            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 cursor-pointer"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
