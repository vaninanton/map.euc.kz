import type { Feature, LineString, Point, Position } from 'geojson'
import ymapsIcon from '../assets/ymaps.svg'
import guruIcon from '../assets/guru.svg'
import twoGisIcon from '../assets/2gis.png'
import shareIcon from '../assets/share.svg'

const getViaPoints = (feature: Feature<LineString | Point, Record<string, any>>, minSteps: number): Position[] => {
    const coords = feature.geometry.coordinates
    if (coords.length <= 2) return []

    const steps = Math.min(minSteps, coords.length - 2)
    const viaPoints: Position[] = []

    for (let i = 1; i <= steps; i++) {
        const idx = Math.round((i / (steps + 1)) * (coords.length - 1))
        viaPoints.push(feature.geometry.coordinates[idx] as Position)
    }

    return viaPoints
}

const linkYandex = (feature: Feature<LineString | Point, Record<string, any>>): string|null => {
    if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates
        return `<a href="https://yandex.ru/maps/?rtext=~${lat},${lon}&rtt=sc" target="_blank" class="text-nowrap">
            <img src="${ymapsIcon}" class="max-w-4 max-h-4 inline" />
            Я.Карты
        </a>`
    }
    return null
}

const link2gis = (feature: Feature<LineString | Point, Record<string, any>>) => {
    if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates
        const isMobile2GisType = window.innerWidth <= 800 ? 'scooter' : 'pedestrian'
        return `<a href="https://2gis.kz/directions/tab/${isMobile2GisType}/points/|${lon},${lat}" target="_blank" class="text-nowrap">
            <img src="${twoGisIcon}" class="max-w-4 max-h-4 inline" />
            2GIS
        </a>`
    }
    return null
}

const linkGuruMaps = (feature: Feature<LineString | Point, Record<string, any>>): string => {
    const url = new URL('guru://nav')
    url.searchParams.append('mode', 'bicycle')

    if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates
        url.searchParams.append('start', [lon, lat].reverse().join(','))
    }

    // Если это маршрут - ставим промежуточные точки
    if (feature.geometry.type === 'LineString') {
        const [lon, lat] = feature.geometry.coordinates[0]
        url.searchParams.append('start', [lon, lat].reverse().join(','))

        if (feature.geometry.coordinates.length) {
            getViaPoints(feature, 4).forEach((v) => url.searchParams.append('via', [v[0], v[1]].reverse().join(',')))

            const [finishLon, finishLat] = feature.geometry.coordinates[feature.geometry.coordinates.length - 1]
            url.searchParams.append('finish', [finishLon, finishLat].reverse().join(','))
        }
    }

    return `<a href="${url.href}" class="text-nowrap"><img src="${guruIcon}" class="max-w-4 max-h-4 inline" /> Guru</a>`
}

const linkProjectOsrm = (feature: Feature<LineString | Point, Record<string, any>>): string|null => {
    if (feature.geometry.type !== 'LineString') {
        return null;
    }

    const url = new URL('https://classic-maps.openrouteservice.org/directions')
    url.searchParams.append('b', '1f')
    url.searchParams.append('c', '0')

    let a = [];
    if (feature.geometry.coordinates.length) {
        const [lon, lat] = feature.geometry.coordinates[0]
        a.push([lon, lat].reverse().join(','))
        getViaPoints(feature, 40).forEach((v) => a.push([v[0], v[1]].reverse().join(',')))

        const [finishLon, finishLat] = feature.geometry.coordinates[feature.geometry.coordinates.length - 1]
        a.push([finishLon, finishLat].reverse().join(','))
    }
    url.searchParams.append('a', a.join(','));
    return `<a href="${url.href}" target="_blank" class="text-nowrap">
        <img src="${shareIcon}" class="max-w-4 max-h-4 inline" />
        OpenRoute
    </a>`

}

const linkShare = (feature: Feature<LineString | Point, Record<string, any>>): string => {
    return `<a href="${window.location.origin}${window.location.pathname}#${feature.properties.type}=${feature.properties.id}" target="_blank" class="text-nowrap js-share">
        <img src="${shareIcon}" class="max-w-4 max-h-4 inline" />
        <span class="js-share-text">Поделиться</span>
    </a>`;
}

export default function CreateShareLinks(feature: Feature<LineString | Point, Record<string, any>>) {
    return [linkYandex(feature), link2gis(feature), linkGuruMaps(feature), linkProjectOsrm(feature), linkShare(feature)].filter(Boolean)
}
