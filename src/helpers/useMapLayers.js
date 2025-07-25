import * as L from 'leaflet'
import velojol2geojson from './Velojol2GeoJson'
import { greenIcon, blueIcon } from './markerIcons'
import createTooltip from './createTooltip'
import createPopup from './createPopup'

import pointsGeojson from '../assets/points.json'
import routesGeojson from '../assets/routes.json'
import socketsGeojson from '../assets/sockets.json'
import velojolAlmaty from '../assets/velojol/almaty.json'

export const createPointsLayer = () =>
    L.geoJSON(pointsGeojson, {
        pmIgnore: true,
        pointToLayer: (_, latlng) => L.marker(latlng, { icon: blueIcon }),
        onEachFeature: (feature, layer) => {
            createTooltip(feature, layer, 'point')
            createPopup(feature, layer, 'point')
        },
    })

export const createSocketsLayer = () =>
    L.geoJSON(socketsGeojson, {
        pmIgnore: true,
        pointToLayer: (_, latlng) => L.marker(latlng, { icon: greenIcon }),
        onEachFeature: (feature, layer) => {
            createTooltip(feature, layer, 'socket')
            createPopup(feature, layer, 'socket')
        },
    })

export const createRoutesLayer = () =>
    L.geoJSON(routesGeojson, {
        pmIgnore: true,
        style: { color: '#f25824', weight: 2.5 },
        onEachFeature: (feature, layer) => {
            createTooltip(feature, layer, 'route')
            createPopup(feature, layer, 'route')

            let defaultColor = '#f25824'
            let hoverColor = '#ff8800'
            let defaultStyleColor
            layer.on('mouseover', function (e) {
                defaultStyleColor = e.target.options.style.color || defaultColor
                e.target.setStyle({
                    color: hoverColor,
                })
            })
            layer.on('mouseout', function (e) {
                e.target.setStyle({ color: defaultStyleColor })
            })
        },
    })

export const createBikelanesLayer = () => {
    const veloGeoJson = velojol2geojson(velojolAlmaty, ['alm84', 'alm85', 'alm86', 'alm89'])
    return L.geoJSON(veloGeoJson, {
        pmIgnore: true,
        style: { color: 'green', weight: 3, dashArray: '6, 6' },
        onEachFeature: (feature, layer) => {
            createTooltip(feature, layer, 'bikelane')
            createPopup(feature, layer, 'bikelane')
        },
    })
}
