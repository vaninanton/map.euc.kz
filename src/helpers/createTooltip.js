import calculateRouteDistance from './CalculateRouteDistance'

export default function createTooltip(feature, layer, type) {
    if (type === 'point') {
        layer.bindTooltip(feature.properties.name || 'Точка')
    } else if (type === 'socket') {
        layer.bindTooltip('Розетка ' + feature.properties.name)
    } else if (type === 'route') {
        let tooltipContent = []
        tooltipContent.push(feature.properties.name || 'Маршрут')
        const { distance } = calculateRouteDistance(feature)
        tooltipContent.push('<span class="text-gray-600">(' + distance.toFixed(0) + ' км)</span>')
        layer.bindTooltip(tooltipContent.join(' '))
    }
}
