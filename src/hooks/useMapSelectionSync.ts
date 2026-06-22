import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HASH_TYPE_TO_LAYER_KEY, buildMapDeepLinkPath, parseHash, parseMapDeepLinkPathname } from '@/utils/hashNav'
import type { Feature } from '@/types/geojson'
import type { LayerKey } from '@/constants'

interface UseMapSelectionSyncOptions {
    enabled: boolean
    getFeatureById: (layer: LayerKey, id: string) => Feature | null
    openFeature: (feature: Feature, layerKey: LayerKey) => void
    ensureLayerVisible: (layer: LayerKey) => void
}

/**
 * Выбор объекта на карте из URL: путь `/m/:тип/:id` (react-router) и устаревший hash `#type=id`.
 */
export function useMapSelectionSync(options: UseMapSelectionSyncOptions) {
    const { enabled, getFeatureById, openFeature, ensureLayerVisible } = options
    const location = useLocation()
    const navigate = useNavigate()
    const lastSyncedKeyRef = useRef<string | null>(null)
    const rafIdRef = useRef<number | null>(null)

    useEffect(() => {
        if (!enabled) return

        if (typeof window !== 'undefined' && window.location.hash.length > 1) {
            const fromHash = parseHash()
            if (fromHash) {
                const path = `/${buildMapDeepLinkPath(fromHash.type, fromHash.id)}`
                void navigate({ pathname: path, hash: '' }, { replace: true })
                return
            }
        }

        const fromPath = parseMapDeepLinkPathname(location.pathname)
        if (!fromPath) {
            lastSyncedKeyRef.current = null
            return
        }

        const key = `${fromPath.type}:${fromPath.id}`
        if (key === lastSyncedKeyRef.current) return

        const layerKey = HASH_TYPE_TO_LAYER_KEY[fromPath.type]
        ensureLayerVisible(layerKey)
        const feature = getFeatureById(layerKey, fromPath.id)
        if (!feature) return

        if (rafIdRef.current !== null) {
            window.cancelAnimationFrame(rafIdRef.current)
        }
        rafIdRef.current = requestAnimationFrame(() => {
            openFeature(feature, layerKey)
            lastSyncedKeyRef.current = key
        })
    }, [enabled, location.pathname, location.hash, navigate, getFeatureById, openFeature, ensureLayerVisible])

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return

        const onHashChange = () => {
            const fromHash = parseHash()
            if (fromHash) {
                const path = `/${buildMapDeepLinkPath(fromHash.type, fromHash.id)}`
                void navigate({ pathname: path, hash: '' }, { replace: true })
            }
        }

        window.addEventListener('hashchange', onHashChange)
        return () => {
            window.removeEventListener('hashchange', onHashChange)
        }
    }, [enabled, navigate])

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                window.cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
            }
        }
    }, [])
}
