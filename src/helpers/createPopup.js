import calculateRouteDistance from './CalculateRouteDistance'
import FeatureTypes from './FeatureTypes'
import ymapsIcon from '../assets/ymaps.svg'
import guruIcon from '../assets/guru.svg'
import twoGisIcon from '../assets/2gis.png'
import shareIcon from '../assets/share.svg'

export default function createPopup(feature, layer) {
    const { type, name, description, id } = feature.properties ?? {}
    const coordinates = feature.geometry.coordinates
    const isPoint = feature.geometry.type === 'Point'
    const isRoute = feature.geometry.type === 'LineString'
    const webShareSupported = 'canShare' in navigator

    let content = []
    if (type && FeatureTypes[type]) {
        content.push(`<span class="text-gray-500">${FeatureTypes[type].name}</span> `)
    }
    if (name) {
        content.push(`&laquo;<span class="font-bold">${name}</span>&raquo;`)
    }
    if (type === 'route') {
        const { distance, gain, loss } = calculateRouteDistance(feature.geometry.coordinates)
        content.push('<div class="grid grid-cols-3 gap-2 mb-2">')
        content.push(
            '<span><span class="block text-gray-500">Расстояние:</span> ' + distance.toFixed(1) + '&nbsp;км</span>',
        )
        if (gain > 0) {
            content.push('<span><span class="block text-gray-500">Подъём:</span> ' + gain.toFixed(0) + '&nbsp;м</span>')
        }
        if (loss > 0) {
            content.push('<span><span class="block text-gray-500">Спуск:</span> ' + loss.toFixed(0) + '&nbsp;м</span>')
        }
        content.push('</div>')
    }
    if (description) {
        content.push(`<div class="mb-2">${description}</div>`)
    }
    if (isPoint) {
        content.push('<div class="mt-2 flex flex-wrap gap-2">')
        content.push(
            `<a href="https://yandex.ru/maps/?rtext=~${coordinates[1]},${coordinates[0]}&rtt=sc" target="_blank" class="text-nowrap">
                <img src="${ymapsIcon}" class="max-w-4 max-h-4 inline" />
                Я.Карты
            </a>`,
        )
        // На компьютере используем пешие маршруты, на мобильном - скутерные
        const isMobile2GisType = window.innerWidth <= 800 ? 'scooter' : 'pedestrian'
        content.push(
            `<a href="https://2gis.kz/directions/tab/${isMobile2GisType}/points/|${coordinates[0]},${coordinates[1]}" target="_blank" class="text-nowrap">
                <img src="${twoGisIcon}" class="max-w-4 max-h-4 inline" />
                2GIS
            </a>`,
        )
        content.push(
            `<a href="guru://nav?finish=${coordinates[1]},${coordinates[0]}&mode=bicycle" target="_blank" class="text-nowrap">
                <img src="${guruIcon}" class="max-w-4 max-h-4 inline" />
                GuruMaps
            </a>`,
        )
        if (webShareSupported) {
            content.push(
                `<a href="${window.location.origin}${window.location.pathname}#${type}=${id}" target="_blank" class="text-nowrap js-share">
                    <img src="${shareIcon}" class="max-w-4 max-h-4 inline" />
                    Поделиться
                </a>`,
            )
        }
        content.push('</div>')
    } else if (isRoute) {
        content.push('<div class="mt-2 flex flex-wrap gap-2">')
        const start = coordinates.at(0);
        const finish = coordinates.at(-1);
        const steps = 4;
        const viaPoints = [];

        for (let i = 1; i < steps - 1; i++) {
            const idx = Math.round((i / (steps - 1)) * (coordinates.length - 1));
            viaPoints.push(coordinates[idx]);
        }

        const guruParams = new URLSearchParams({
            mode: "bicycle",
            start: start[1] + ',' + start[0],
            finish: finish[1] + ',' + finish[0]
        });
        viaPoints.forEach(v => guruParams.append('via', v[1] + ',' + v[0]));

        const url = `guru://nav?${guruParams.toString()}`;

        content.push(
            `<a href="${url}" target="_blank" class="text-nowrap">
                <img src="${guruIcon}" class="max-w-4 max-h-4 inline" />
                GuruMaps
            </a>`,
        )
        if (webShareSupported) {
            content.push(
                `<a href="${window.location.origin}${window.location.pathname}#${type}=${id}" target="_blank" class="text-nowrap js-share">
                    <img src="${shareIcon}" class="max-w-4 max-h-4 inline" />
                    Поделиться
                </a>`,
            )
        }
        content.push('</div>')
    }
    layer.bindPopup(content.join(''))

    layer.on('popupopen', (e) => {
        if (['point', 'socket', 'route'].includes(type) === false) return

        window.history.replaceState(null, '', `#${type}=${e.target.feature.properties.id}`)

        e.target._popup._container.querySelectorAll('.js-share').forEach((el) => {
            el.addEventListener('click', async (event) => {
                event.preventDefault()
                const url = event.target.getAttribute('href')

                const webShareSupported = 'canShare' in navigator
                if (!webShareSupported) return

                if (navigator.canShare()) {
                    try {
                        await navigator.share({ url })
                    } catch (err) {
                        console.error(err)
                    }
                } else {
                    const oldText = event.target.innerHTML
                    try {
                        await navigator.clipboard.writeText(url)
                    } catch (error) {
                        console.error(error)
                    }
                    event.target.innerHTML = 'Скопировано!'
                    setTimeout(() => {
                        event.target.innerHTML = oldText
                    }, 2000)
                }
            })
        })
    })
    layer.on('popupclose', (e) => window.history.replaceState(null, '', `#`))
}
