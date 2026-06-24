/** Иконка Telegram (бумажный самолётик). Размер задаётся пропсами, по умолчанию 20×20. */
export function IconTelegram({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M9.78 16.57 9.4 20.9c.54 0 .77-.23 1.04-.5l2.49-2.38 5.17 3.78c.95.52 1.62.25 1.88-.88l3.4-15.94h.01c.31-1.46-.53-2.03-1.45-1.69L1.98 11.05c-1.4.55-1.38 1.33-.24 1.68l5.1 1.59L18.7 6.9c.56-.34 1.07-.15.65.19" />
        </svg>
    )
}
