/**
 * Централизованное чтение переменных окружения Vite с нормализацией строк и чисел.
 */
import { parsePositiveInt } from '@/utils/numberParsers';

const DEFAULT_TELEGRAM_GEO_TTL_MINUTES = 60;
const DEFAULT_TELEGRAM_MAX_ACCURACY_METERS = 100;
const DEFAULT_TELEGRAM_TRACK_TAIL_MINUTES = 30;

function readOptionalTrimmedString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const t = value.trim();
    return t === '' ? undefined : t;
}

/** Пара ключей для публичного клиента Supabase (anon). */
export function getViteSupabaseConfig(): { url: string; key: string } | null {
    const url = readOptionalTrimmedString(import.meta.env.VITE_SUPABASE_URL);
    const key = readOptionalTrimmedString(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    if (!url || !key) return null;
    return { url, key };
}

/** TTL Telegram-гео (минуты), с безопасным fallback на дефолт. */
export function getTelegramGeoTtlMinutes(): number {
    return parsePositiveInt(import.meta.env.VITE_TELEGRAM_GEO_TTL_MINUTES, DEFAULT_TELEGRAM_GEO_TTL_MINUTES);
}

/** Максимальная допустимая погрешность Telegram-гео (метры). */
export function getTelegramMaxAccuracyMeters(): number {
    return parsePositiveInt(import.meta.env.VITE_TELEGRAM_MAX_ACCURACY_METERS, DEFAULT_TELEGRAM_MAX_ACCURACY_METERS);
}

/** Длина хвоста Telegram-трека (минуты). */
export function getTelegramTrackTailMinutes(): number {
    return parsePositiveInt(import.meta.env.VITE_TELEGRAM_TRACK_TAIL_MINUTES, DEFAULT_TELEGRAM_TRACK_TAIL_MINUTES);
}
