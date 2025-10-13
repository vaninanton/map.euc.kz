import * as L from 'leaflet'
import velojol2geojson from './Velojol2GeoJson'
import { greenIcon, blueIcon } from './markerIcons'
import createTooltip from './createTooltip'
import createPopup from './createPopup'

import pointsGeojson from '../assets/points.json?version=2'
import routesGeojson from '../assets/routes.json?version=2'
import socketsGeojson from '../assets/sockets.json?version=2'
import velojolAlmaty from '../assets/velojol/almaty.json?version=2'

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
        attribution: 'Велодорожки: <a href="https://velojol.kz" target="_blank">velojol.kz</a>',
        style: { color: 'green', weight: 3, dashArray: '6, 6' },
        onEachFeature: (feature, layer) => {
            createTooltip(feature, layer, 'bikelane')
            createPopup(feature, layer, 'bikelane')
        },
    })
}
