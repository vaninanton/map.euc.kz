import { describe, it, expect } from 'vitest'
import { parseAuthRedirectError, stripAuthRedirectError } from '@/admin/utils/authRedirectError'

// Реальный адрес, на который Supabase вернул после неудачной привязки Telegram.
const FAILED_LINK = {
    pathname: '/admin',
    search: '?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user',
    hash: '#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user&sb=',
}

describe('parseAuthRedirectError', () => {
    it('переводит известный код в понятное объяснение', () => {
        expect(parseAuthRedirectError(FAILED_LINK)).toMatch(/уже привязан к другому пользователю/)
    })

    it('для неизвестного кода показывает описание от Supabase', () => {
        expect(parseAuthRedirectError({ search: '', hash: '#error_code=oops&error_description=Something+broke' })).toBe(
            'Something broke',
        )
    })

    it('читает ошибку и из query, когда фрагмента нет', () => {
        expect(parseAuthRedirectError({ search: '?error_code=oops&error_description=Broken', hash: '' })).toBe('Broken')
    })

    it('без ошибки возвращает null', () => {
        expect(parseAuthRedirectError({ search: '?foo=1', hash: '#bar=2' })).toBeNull()
    })
})

describe('stripAuthRedirectError', () => {
    it('вычищает служебные параметры из query и фрагмента', () => {
        expect(stripAuthRedirectError(FAILED_LINK)).toBe('/admin')
    })

    it('не трогает посторонние параметры', () => {
        expect(
            stripAuthRedirectError({
                pathname: '/admin/settings',
                search: '?tab=passkeys&error=server_error',
                hash: '',
            }),
        ).toBe('/admin/settings?tab=passkeys')
    })
})
