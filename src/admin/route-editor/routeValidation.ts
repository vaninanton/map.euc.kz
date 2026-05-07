/** Ошибка валидации названия маршрута или null, если ок. */
export function validateRouteTitleTrimmed(titleTrimmed: string): string | null {
    if (titleTrimmed.length < 4 || titleTrimmed.length > 99) {
        return 'Название должно содержать от 4 до 99 символов.'
    }
    return null
}

export function validateMinimumVertices(vertexCount: number): string | null {
    if (vertexCount < 2) {
        return 'Нужно минимум две вершины маршрута.'
    }
    return null
}
