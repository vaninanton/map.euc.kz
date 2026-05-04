import type { ReactNode } from 'react'

interface ConfirmDialogProps {
    open: boolean
    title: string
    description?: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    danger = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
                <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
                {description && <div className="mt-2 text-sm text-neutral-600">{description}</div>}
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={[
                            'rounded-lg px-3 py-1.5 text-sm font-semibold text-white',
                            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700',
                        ].join(' ')}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
