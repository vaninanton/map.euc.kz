import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTelegram } from '@fortawesome/free-brands-svg-icons'
import {
    faLink,
    faLocationDot,
    faLocationArrow,
    faTowerBroadcast,
    faLocationCrosshairs,
    faMapLocationDot,
} from '@fortawesome/free-solid-svg-icons'

interface ProjectInfoModalProps {
    isOpen: boolean
    onClose: () => void
    onClearCache: () => void
}

interface SectionProps {
    icon: typeof faLink
    iconColor: string
    title: string
    children: ReactNode
}

function HelpSection({ icon, iconColor, title, children }: SectionProps) {
    return (
        <div className="flex gap-4">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
                <FontAwesomeIcon icon={icon} className="text-sm" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-neutral-900">{title}</h3>
                <div className="mt-1 space-y-1 text-sm leading-6 text-neutral-600">{children}</div>
            </div>
        </div>
    )
}

export function ProjectInfoModal({ isOpen, onClose, onClearCache }: ProjectInfoModalProps) {
    return (
        <>
            {isOpen && (
                <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm">
                    <div className="h-full w-full overflow-y-auto safe-area-padding sm:p-6 md:p-8">
                        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col bg-white p-5 sm:rounded-2xl sm:border sm:border-neutral-200 sm:shadow-xl sm:p-6">
                            {/* Шапка */}
                            <div className="mb-1 flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-neutral-900">map.euc.kz</h2>
                                    <p className="mt-1 text-sm text-neutral-500">Карта для моноколесников Алматы</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 cursor-pointer"
                                    aria-label="Закрыть"
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

                            {/* Разделитель */}
                            <div className="my-5 border-t border-neutral-100" />

                            {/* Инструкции */}

                            <div className="space-y-6">
                                <HelpSection
                                    icon={faLocationArrow}
                                    iconColor="bg-green-50 text-green-600"
                                    title="Как поделиться своей геопозицией"
                                >
                                    <p>
                                        Откройте один из Telegram-чатов ниже (или напишите боту{' '}
                                        <a
                                            href="https://t.me/EUCkz_bot"
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="font-medium text-blue-600 hover:underline"
                                        >
                                            @EUCkz_bot
                                        </a>{' '}
                                        в личку) и отправьте свою{' '}
                                        <strong className="text-neutral-800">
                                            геопозицию в режиме реального времени
                                        </strong>
                                        . Карта автоматически отобразит вашу метку — другие участники увидят, где вы
                                        катаетесь.
                                    </p>
                                    <p className="text-neutral-500">
                                        Метка исчезает через {import.meta.env.VITE_TELEGRAM_GEO_TTL_MINUTES ?? '60'}{' '}
                                        минут после последнего обновления.
                                    </p>
                                </HelpSection>
                                <HelpSection
                                    icon={faLink}
                                    iconColor="bg-blue-50 text-blue-600"
                                    title="Поделиться ссылкой"
                                >
                                    <p>
                                        Нажмите на любую точку или маршрут на карте — откроется карточка с информацией.
                                        В ней есть кнопка <strong className="text-neutral-800">«Поделиться»</strong> —
                                        она копирует прямую ссылку на это место. Отправьте её в чат, и человек сразу
                                        откроет карту с выбранной точкой.
                                    </p>
                                </HelpSection>

                                <HelpSection
                                    icon={faMapLocationDot}
                                    iconColor="bg-rose-50 text-rose-500"
                                    title="Проложить маршрут до точки"
                                >
                                    <p>
                                        Нажмите на любую точку — в карточке есть кнопки для открытия маршрута в{' '}
                                        <strong className="text-neutral-800">2GIS</strong> или{' '}
                                        <strong className="text-neutral-800">Яндекс&nbsp;Картах</strong> и заполненной
                                        точкой назначения.
                                    </p>
                                </HelpSection>

                                <HelpSection
                                    icon={faLocationDot}
                                    iconColor="bg-orange-50 text-orange-500"
                                    title="Добавить новую точку или розетку"
                                >
                                    <p>
                                        Нажмите кнопку <strong className="text-neutral-800">«+»</strong> внизу экрана,
                                        затем коснитесь нужного места на карте. Укажите название, тип (встреча /
                                        розетка) и описание — заявка уйдёт на модерацию и появится на карте после
                                        проверки.
                                    </p>
                                </HelpSection>

                                {/* <HelpSection
                                    icon={faRoute}
                                    iconColor="bg-purple-50 text-purple-600"
                                    title="Поделиться маршрутом"
                                >
                                    <p>
                                        Функция в разработке. Скоро можно будет записывать трек поездки
                                        и делиться им прямо из приложения.
                                    </p>
                                </HelpSection> */}

                                <HelpSection icon={faTowerBroadcast} iconColor="bg-sky-50 text-sky-500" title="Радар">
                                    <p>
                                        Радар показывает всех, кто сейчас делится геопозицией, в виде списка с
                                        расстоянием от вас. Нажмите на участника — карта сфокусируется на нём.
                                    </p>
                                    <p>
                                        Открыть радар можно через иконку{' '}
                                        <FontAwesomeIcon icon={faLocationCrosshairs} className="text-xs" aria-hidden />{' '}
                                        в нижней панели
                                    </p>
                                </HelpSection>
                            </div>

                            {/* Разделитель */}
                            <div className="my-5 border-t border-neutral-100" />

                            {/* Telegram-чаты */}
                            <div>
                                <h3 className="mb-1 text-base font-semibold text-neutral-900">Telegram-чаты</h3>
                                <p className="mb-3 text-sm text-neutral-500">
                                    Есть идея или предложение? Пишите в любой из чатов — всегда рады.
                                </p>
                                <div className="flex flex-col gap-2">
                                    <a
                                        href="https://t.me/monoalmaty"
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 text-sm font-semibold text-blue-600 transition hover:bg-neutral-50 hover:text-blue-700 cursor-pointer"
                                    >
                                        <FontAwesomeIcon icon={faTelegram} className="text-2xl shrink-0" aria-hidden />
                                        <span>Моноколеса Алматы</span>
                                    </a>
                                    <a
                                        href="https://t.me/+ADUCLEjBA5pmNjQ6"
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 text-sm font-semibold text-blue-600 transition hover:bg-neutral-50 hover:text-blue-700 cursor-pointer"
                                    >
                                        <FontAwesomeIcon icon={faTelegram} className="text-2xl shrink-0" aria-hidden />
                                        <span>Электроклуб</span>
                                    </a>
                                </div>
                            </div>

                            {/* Подвал */}
                            <div className="mt-auto flex items-center justify-between pt-6">
                                <div className="text-xs text-neutral-400">© {new Date().getFullYear()} map.euc.kz</div>
                                <button
                                    type="button"
                                    onClick={onClearCache}
                                    className="text-[11px] text-neutral-400 transition hover:text-neutral-500 cursor-pointer"
                                >
                                    очистить кеш
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
