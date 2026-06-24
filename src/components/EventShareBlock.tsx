import { buildEventShareLink, buildTelegramEventMessage, buildTelegramShareLink } from '@/utils/shareLinks'
import { trackGoal } from '@/lib/analytics'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { IconTelegram } from '@/components/icons/IconTelegram'
import { ShareLink } from '@/components/ShareIconButton'
import { CopyButton } from '@/components/CopyButton'
import { useCopyShare } from '@/hooks/useCopyShare'
import type { EventRow } from '@/types'

interface EventShareBlockProps {
    event: EventRow
}

/** Блок шаринга события (как у точки/маршрута): Telegram + копирование ссылки. */
export function EventShareBlock({ event }: EventShareBlockProps) {
    const appUrl = buildEventShareLink(event.id)
    const telegramShareLink = buildTelegramShareLink(appUrl, buildTelegramEventMessage(event.title))
    const { showCopied, handleShare } = useCopyShare(appUrl, 'event')

    return (
        <div className="mt-3 border-t border-neutral-200 px-2 pt-3 pb-4">
            <div className="flex flex-wrap gap-2">
                <ShareLink
                    href={telegramShareLink}
                    external
                    accentClass="hover:bg-sky-50 hover:text-sky-600"
                    title="Поделиться в Telegram"
                    ariaLabel="Поделиться в Telegram"
                    onClick={() => {
                        trackGoal('share_telegram', { featureType: 'event' })
                    }}
                >
                    <IconTelegram />
                </ShareLink>
                <CopyButton
                    copied={showCopied}
                    ariaLabel="Копировать ссылку"
                    onClick={() => {
                        void handleShare()
                    }}
                >
                    <FontAwesomeIcon icon={faCopy} className="text-base" aria-hidden />
                </CopyButton>
            </div>
        </div>
    )
}
