import { Route } from 'react-router-dom'
import { MapShell } from '@/app/MapShell'

/** Маршруты публичной карты (отдельно от админки — удобно для разбиения PR). */
export function MapRoutes() {
    return (
        <>
            <Route path="/" element={<MapShell />} />
            <Route path="m/:mapFeatureType/:mapFeatureId" element={<MapShell />} />
        </>
    )
}
