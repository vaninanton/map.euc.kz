import * as L from 'leaflet'
import velojol2geojson from './Velojol2GeoJson'
import { greenIcon, blueIcon } from './markerIcons'
import createTooltip from './createTooltip'
import createPopup from './createPopup'

import velojolAlmaty from '../assets/velojol/almaty.json'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)

export const createPointsLayer = async () => {
    let pointsGeojson = {
        type: 'FeatureCollection',
        features: [],
    }

    try {
        let { data: map_points, error } = await supabase
            .from('map_points')
            .select('id,type,title,description,coordinates')
            .eq('type', 'point')

        if (error) throw error

        map_points.forEach((point) => {
            pointsGeojson.features.push({
                type: 'Feature',
                properties: {
                    id: point.id,
                    type: point.type,
                    name: point.title,
                    description: point.description,
                },
                geometry: {
                    type: 'Point',
                    coordinates: point.coordinates,
                },
            })
        })
    } catch (error) {
        console.log(error)
    }

    return L.geoJSON(pointsGeojson, {
        pmIgnore: true,
        pointToLayer: (_, latlng) => L.marker(latlng, { icon: blueIcon }),
        onEachFeature: (feature, layer) => {
            createTooltip(feature, layer, 'point')
            createPopup(feature, layer, 'point')
        },
    })
}

export const createSocketsLayer = async () => {
    let socketsGeojson = {
        type: 'FeatureCollection',
        features: [],
    }

    try {
        let { data: map_points, error } = await supabase
            .from('map_points')
            .select('id,type,title,description,coordinates')
            .eq('type', 'socket')

        if (error) throw error

        map_points.forEach((point) => {
            socketsGeojson.features.push({
                type: 'Feature',
                properties: {
                    id: point.id,
                    type: point.type,
                    name: point.title,
                    description: point.description,
                },
                geometry: {
                    type: 'Point',
                    coordinates: point.coordinates,
                },
            })
        })
    } catch (error) {
        console.log(error)
    }

    return L.geoJSON(socketsGeojson, {
        pmIgnore: true,
        pointToLayer: (_, latlng) => L.marker(latlng, { icon: greenIcon }),
        onEachFeature: (feature, layer) => {
            createTooltip(feature, layer, 'socket')
            createPopup(feature, layer, 'socket')
        },
    })
}

export const createRoutesLayer = async () => {
    let routesGeojson = {
        type: 'FeatureCollection',
        features: [],
    }

    try {
        let { data: map_routes, error } = await supabase
            .from('map_routes')
            .select('id,type,title,description,coordinates')
            .eq('type', 'route')
            .eq('flag_disabled', false)

        if (error) throw error

        map_routes.forEach((route) => {
            routesGeojson.features.push({
                type: 'Feature',
                properties: {
                    id: route.id,
                    type: route.type,
                    name: route.title,
                    description: route.description,
                },
                geometry: {
                    type: 'LineString',
                    coordinates: route.coordinates,
                },
            })
        })
    } catch (error) {
        console.log(error)
    }

    return L.geoJSON(routesGeojson, {
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
}

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
