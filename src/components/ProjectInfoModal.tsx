import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTelegram } from '@fortawesome/free-brands-svg-icons'

interface ProjectInfoModalProps {
    isOpen: boolean
    onClose: () => void
    onClearCache: () => void
}

export function ProjectInfoModal({ isOpen, onClose, onClearCache }: ProjectInfoModalProps) {
    return (
        <>
            {isOpen && (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm">
          <div className="h-full w-full overflow-y-auto safe-area-padding sm:p-6 md:p-8">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="text-2xl font-bold text-neutral-900">map.euc.kz</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 cursor-pointer"
                  aria-label="Закрыть модалку"
                  title="Закрыть"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                    <path
                      d="M6 6L14 14M14 6L6 14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <p className="text-sm leading-6 text-neutral-700">
                map.euc.kz — карта для моноколесников Алматы: места встреч, розетки, маршруты, велодорожки.
              </p>
              <p className="mt-3 text-sm leading-6 text-neutral-700">
                Вы можете поделиться геопозицией в одном из Telegram-чатов, мы отобразим её на карте.
              </p>

              <div className="mt-6 flex items-center justify-center gap-4">
                <a
                  href="https://t.me/monoalmaty"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="w-full max-w-[200px] aspect-square rounded-xl border border-neutral-200 p-4 inline-flex flex-col items-center justify-center gap-2 text-center text-sm font-semibold text-blue-600 transition hover:bg-neutral-50 hover:text-blue-700 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faTelegram} className="text-4xl" aria-hidden />
                  <span>Моноколеса Алматы</span>
                </a>

                <a
                  href="https://t.me/+ADUCLEjBA5pmNjQ6"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="w-full max-w-[200px] aspect-square rounded-xl border border-neutral-200 p-4 inline-flex flex-col items-center justify-center gap-2 text-center text-sm font-semibold text-blue-600 transition hover:bg-neutral-50 hover:text-blue-700 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faTelegram} className="text-4xl" aria-hidden />
                  <span>Электроклуб</span>
                </a>
              </div>

              <button
                type="button"
                onClick={onClearCache}
                className="mt-auto self-start pt-8 text-[11px] text-neutral-400 transition hover:text-neutral-500 cursor-pointer"
              >
                очистить кеш
              </button>
              <div className="pt-1 text-xs text-neutral-500">
                © {new Date().getFullYear()} map.euc.kz
              </div>
            </div>
          </div>
                </div>
            )}
        </>
    )
}
