import calculateRouteDistance from './CalculateRouteDistance'
import FeatureTypes from './FeatureTypes'
import CreateShareLinks from './CreateShareLinks'

export default function createPopup(feature, layer) {
    const { type, name, description, id } = feature.properties ?? {}

    let content = []
    content.push(`<div class="w-75">`)
    if (type && FeatureTypes[type]) {
        content.push(`<span class="text-gray-500">${FeatureTypes[type].name}</span> `)
    }
    if (name) {
        content.push(`&laquo;<span class="font-bold">${name}</span>&raquo;`)
    }

    if (feature.geometry.type === 'LineString') {
        const { distance, gain, loss, avgGrade, maxGrade, maxElevation, minElevation, twistiness, difficulty } = calculateRouteDistance(feature)
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

        // content.push('<div class="w-full">')
        //     content.push('<div>Уклон сред/макс: ' + avgGrade.toFixed(1) + '%/' + maxGrade.toFixed(1) + '%</div> ')
        //     content.push('<div>Высота мин/макс: ' + minElevation.toFixed(0) + 'м/' + maxElevation.toFixed(0) + 'м</div> ')
        //     content.push('<div>Извилистость: ' + twistiness.toFixed(1) + '</div> ')
        //     content.push('<div>Сложность: ' + difficulty + '</div> ')
        // content.push('</div>')
    }
    if (description) {
        content.push(`<div class="mb-2">${description}</div>`)
    }

    if (type !== 'bikelane') {
        const shareLinks = CreateShareLinks(feature)
        if (shareLinks.length > 0) {
            content.push('<div class="mt-2 flex flex-wrap gap-2">')
            CreateShareLinks(feature).forEach((link) => {
                content.push(link)
            });
            content.push('</div>')
        }
    }

    content.push(`</div>`)
    layer.bindPopup(content.join(''))

    layer.on('popupopen', (e) => {
        if (['point', 'socket', 'route'].includes(type) === false) return

        window.history.replaceState(null, '', `#${type}=${e.target.feature.properties.id}`)

        e.target._popup._container.querySelectorAll('.js-share').forEach((el) => {
            el.addEventListener('click', async (event) => {
                event.preventDefault()
                const link = event.currentTarget
                const url = link.getAttribute('href')

                if ('canShare' in navigator && navigator.canShare()) {
                    try {
                        await navigator.share({ url })
                    } catch (err) {
                        console.error(err)
                    }
                } else {
                    const oldText = link.querySelector('.js-share-text').innerHTML
                    try {
                        await navigator.clipboard.writeText(url)
                    } catch (error) {
                        console.error(error)
                    }
                    el.querySelector('.js-share-text').innerHTML = 'Скопировано в буфер обмена'
                    setTimeout(() => {
                        el.querySelector('.js-share-text').innerHTML = oldText
                    }, 5000)
                }
            })
        })
    })
    layer.on('popupclose', (e) => window.history.replaceState(null, '', '#'))
}
