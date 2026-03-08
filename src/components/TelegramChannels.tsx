const TELEGRAM_LINKS = {
  monoalmaty: 'https://t.me/monoalmaty',
  electroclub: 'https://t.me/+ADUCLEjBA5pmNjQ6',
} as const;

export function TelegramChannels() {
  return (
    <div
      className="flex flex-col gap-2 p-2"
      role="group"
      aria-label="Telegram-каналы"
    >
      <a
        href={TELEGRAM_LINKS.monoalmaty}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 rounded-lg bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-neutral-800 text-xs transition-colors border border-[#0088cc]/20"
      >
        Моноколеса Алматы
      </a>
      <a
        href={TELEGRAM_LINKS.electroclub}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 rounded-lg bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-neutral-800 text-xs transition-colors border border-[#0088cc]/20"
      >
        Электроклуб
      </a>
    </div>
  );
}
