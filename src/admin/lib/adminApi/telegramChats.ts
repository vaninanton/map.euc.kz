import type { AdminTelegramChat, TelegramChatInput, TelegramChatPatch } from '@/admin/lib/adminApi/types'
import { db, runManyParsed, runOneParsed } from '@/admin/lib/adminApi/query'
import { parseAdminTelegramChat } from '@/admin/lib/adminApi/parsers'

const CHAT_COLUMNS = 'id, chat_id, title, enabled, sort_order, created_at, message_thread_id'

/** Все назначения рассылки (чат+тема), отсортированные по порядку. */
export async function listTelegramChats(): Promise<AdminTelegramChat[]> {
    return runManyParsed(
        'listTelegramChats',
        db().from('telegram_chats').select(CHAT_COLUMNS).order('sort_order', { ascending: true }),
        (raw) => parseAdminTelegramChat(raw),
    )
}

export async function createTelegramChat(input: TelegramChatInput): Promise<AdminTelegramChat> {
    return runOneParsed(
        'createTelegramChat',
        db().from('telegram_chats').insert(input).select(CHAT_COLUMNS).single(),
        parseAdminTelegramChat,
    )
}

/** Обновляет назначение по суррогатному id (chat_id больше не уникален). */
export async function updateTelegramChat(id: string, patch: TelegramChatPatch): Promise<AdminTelegramChat> {
    return runOneParsed(
        'updateTelegramChat',
        db().from('telegram_chats').update(patch).eq('id', id).select(CHAT_COLUMNS).single(),
        parseAdminTelegramChat,
    )
}

export async function deleteTelegramChat(id: string): Promise<void> {
    const { error } = await db().from('telegram_chats').delete().eq('id', id)
    if (error) {
        console.error('deleteTelegramChat:', error)
        throw new Error(error.message)
    }
}
