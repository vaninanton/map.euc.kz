<script setup>
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import 'leaflet-providers/leaflet-providers'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

import { LocateControl } from 'leaflet.locatecontrol'
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css'

import { createPointsLayer, createSocketsLayer, createRoutesLayer, createBikelanesLayer } from '../helpers/useMapLayers'

import { decode } from 'js-base64'
import { redIcon } from '../helpers/markerIcons'
import FeatureTypeWizard from './FeatureTypeWizard.vue'
import FeatureShare from './FeatureShare.vue'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

const showWizard = ref(false)
const currentLayer = ref(null)
const showShare = ref(false)
const shareData = ref(null)

const map = shallowRef(null)

const baseLayers = {
    osm: shallowRef(null),
    mapbox: shallowRef(null),
}

const layers = {
    points: shallowRef(null),
    sockets: shallowRef(null),
    routes: shallowRef(null),
    bikelanes: shallowRef(null),
}

const initBaseLayers = () => {
    return {
        osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
                '&copy; OpenStreetMap, TG: <a href="https://t.me/+m9ifLDAQddM5ZDEy" target="_blank">Электроклуб Алматы</a>',
        }),
        mapbox: L.tileLayer.provider('MapBox', {
            id: 'vanton/cmcw742a0002m01s945vc1s0n',
            accessToken: 'pk.eyJ1IjoidmFudG9uIiwiYSI6ImNtY3c2bWo4djA2amcybXBlams0ODI0cHQifQ.-PFTlBSPris_3p7XD29szA',
        }),
    }
}

const handleWizardSelect = () => {
    // Скрываем визард
    showWizard.value = false
    currentLayer.value = null
}

const handleWizardSave = (data) => {
    // Скрываем визард и показываем share
    showWizard.value = false
    shareData.value = data
    showShare.value = true
}

const handleWizardCancel = () => {
    // Удаляем слой если пользователь отменил
    if (currentLayer.value) {
        map.value.removeLayer(currentLayer.value)
    }
    showWizard.value = false
    currentLayer.value = null
}

const handleShareClose = () => {
    showShare.value = false
    shareData.value = null
    currentLayer.value = null
}

const focusLayerById = function (id, type, setView = true) {
    id = parseInt(id, 10)
    const layerGroup = layers[type]?.value
    console.log(layerGroup)
    if (!layerGroup) return

    layerGroup.eachLayer((layer) => {
        if (layer.feature?.properties?.id === id) {
            if (map.value && setView) {
                map.value.setView(layer.getLatLng(), 15)
            }
            layer.fire('click')
        }
    })
}

const parseHash = () => {
    const hash = window.location.hash.substring(1)
    if (!hash) return

    const parsedHash = new URLSearchParams(hash)

    if (parsedHash.has('point')) {
        focusLayerById(parsedHash.get('point'), 'points', true)
    }

    if (parsedHash.has('socket')) {
        focusLayerById(parsedHash.get('socket'), 'sockets', true)
    }

    if (parsedHash.has('route')) {
        focusLayerById(parsedHash.get('route'), 'routes', false)
    }

    if (parsedHash.has('share')) {
        try {
            const shareBase64 = decodeURIComponent(parsedHash.get('share'))
            const shareJson = decode(shareBase64)
            shareData.value = JSON.parse(shareJson)
            showShare.value = true

            L.geoJSON(parsedData.geoJson, {
                pmIgnore: true,
                style: { color: 'red', weight: 3, dashArray: '6, 6' },
                // onEachFeature: (feature, layer) => createPopupForFeature(feature, layer),
                pointToLayer: (_, latlng) => L.marker(latlng, { icon: redIcon }),
            }).addTo(map.value)
        } catch (err) {
            console.error('Ошибка при разборе share ссылки:', err)
        }
    }
}

onMounted(async () => {
    map.value = L.map('map').setView([43.226807, 76.904848], 12)
    map.value.pm.setLang('ru')
    map.value.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawCircleMarker: false,
        drawPolygon: false,
        drawRectangle: false,
        drawCircle: false,
        drawText: false,
        rotateMode: false,
        dragMode: false,
        editMode: false,
        removalMode: false,
        cutPolygon: false,
    })

    L.Icon.Default.mergeOptions({
        iconUrl: markerIconUrl,
        iconRetinaUrl: markerIconRetinaUrl,
        shadowUrl: markerShadowUrl,
    })

    const initializedBaseLayers = initBaseLayers()
    baseLayers.osm.value = initializedBaseLayers.osm
    baseLayers.mapbox.value = initializedBaseLayers.mapbox

    layers.points.value = await createPointsLayer()
    layers.sockets.value = await createSocketsLayer()
    layers.routes.value = createRoutesLayer()
    layers.bikelanes.value = createBikelanesLayer()

    baseLayers.osm.value.addTo(map.value)
    layers.points.value.addTo(map.value)
    layers.sockets.value.addTo(map.value)
    layers.routes.value.addTo(map.value)

    const controlBaseLayers = {
        OpenStreetMap: baseLayers.osm.value,
        MapBox: baseLayers.mapbox.value,
    }

    const controlOverlays = {
        Точки: layers.points.value,
        Розетки: layers.sockets.value,
        Маршруты: layers.routes.value,
        Велодорожки: layers.bikelanes.value,
    }

    L.control.layers(controlBaseLayers, controlOverlays, { collapsed: true, position: 'bottomleft' }).addTo(map.value)

    const locateControl = new LocateControl({
        position: 'bottomright',
        keepCurrentZoomLevel: true,
        drawCircle: false,
        showPopup: false,
        strings: {
            title: 'Показать моё местоположение',
        },
        locateOptions: {
            enableHighAccuracy: true,
        },
    })

    locateControl.addTo(map.value)
    // L.control
    //     .locate({
    //         position: 'topleft',
    //         strings: {
    //             title: 'Показать моё местоположение',
    //         },
    //         locateOptions: {
    //             enableHighAccuracy: true,
    //         },
    //     })
    //     .addTo(map.value)

    map.value.on('pm:create', (e) => {
        currentLayer.value = e.layer
        showWizard.value = true
    })

    // Подключение hash-ссылки
    window.addEventListener('hashchange', parseHash)
    parseHash()
})

onBeforeUnmount(() => {
    if (map.value) map.value.remove()
    window.removeEventListener('hashchange', parseHash)
})
</script>

<template>
    <div id="map"></div>

    <FeatureTypeWizard
        :visible="showWizard"
        :layer="currentLayer"
        @select="handleWizardSelect"
        @save="handleWizardSave"
        @cancel="handleWizardCancel"
    />

    <FeatureShare :visible="showShare" :shareData="shareData" @close="handleShareClose" />
</template>

<style scoped>
#map {
    height: 100vh;
    width: 100vw;
}
</style>
