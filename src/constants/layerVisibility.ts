/** Видимость тематических слоёв карты (persist в localStorage через store). */
export interface LayerVisibility {
    points: boolean
    sockets: boolean
    routes: boolean
    bikeLanes: boolean
    telegramUsers: boolean
}
