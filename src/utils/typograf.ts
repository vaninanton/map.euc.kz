import Typograf from 'typograf'

/** Единый инстанс типографа (ru + en) для расстановки неразрывных пробелов, кавычек и т.п. */
const typograf = new Typograf({ locale: ['ru', 'en-US'] })

/** Применяет типографские правила к тексту, возвращает HTML-строку. */
export function applyTypography(text: string): string {
    return typograf.execute(text)
}
