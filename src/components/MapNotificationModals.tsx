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
    return (
        <>
            {errorMessage && (
                <div className="absolute top-0 left-1/2 z-20 flex max-w-100 -translate-x-1/2 items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-md overlay-safe-inset">
                    <span>{errorMessage}</span>
                    <button
                        type="button"
                        onClick={onResetCacheAndReload}
                        disabled={isResettingCache}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                    >
                        Обновить страницу
                    </button>
                </div>
            )}
            {!errorMessage && !loading && emptyMessage && (
                <div className="absolute top-0 left-1/2 z-20 flex max-w-100 -translate-x-1/2 items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 shadow-md overlay-safe-inset">
                    <span>{emptyMessage}</span>
                </div>
            )}
            {draftSubmitSuccess && (
                <div className="absolute top-0 left-1/2 z-20 flex max-w-100 -translate-x-1/2 items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-md overlay-safe-inset">
                    <span>{draftSubmitSuccess}</span>
                </div>
            )}
            {locationErrorMessage && (
                <div className="absolute top-0 left-1/2 z-20 flex max-w-100 -translate-x-1/2 items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 shadow-md overlay-safe-inset">
                    <span>{locationErrorMessage}</span>
                    <button
                        type="button"
                        onClick={onCloseLocationError}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 cursor-pointer"
                    >
                        Закрыть
                    </button>
                </div>
            )}
        </>
    )
}
