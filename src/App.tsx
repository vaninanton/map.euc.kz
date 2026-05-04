import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { YandexMetrika } from '@/components/YandexMetrika'
import { PwaPrompts } from '@/components/PwaPrompts'
import { AdminRoutes } from '@/app/AdminRoutes'
import { MapRoutes } from '@/app/MapRoutes'
import { NotFound } from '@/app/NotFound'

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <YandexMetrika />
            <Routes>
                <MapRoutes />
                <AdminRoutes />
                <Route path="*" element={<NotFound />} />
            </Routes>
            <PwaPrompts />
        </BrowserRouter>
    )
}
