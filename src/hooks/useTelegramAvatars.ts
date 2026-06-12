import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection } from '@/types/geojson';

const AVATAR_SIZE = 48; // px, рендеринг в 2× для HiDPI → Mapbox pixelRatio=2 → 24px на экране
const AVATAR_PREFIX = 'tg-avatar-';

/** Рисует квадратное изображение с круговой маской в canvas и возвращает ImageData. */
function drawCircularAvatar(img: HTMLImageElement, size: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    // Белый бордер
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    return ctx.getImageData(0, 0, size, size);
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { resolve(img); };
        img.onerror = reject;
        img.src = url;
    });
}

/** Извлекает из FeatureCollection уникальные пары (telegramUserId → avatarUrl). */
function extractAvatars(geo: FeatureCollection | null): Map<number, string> {
    const result = new Map<number, string>();
    if (!geo) return result;
    for (const feature of geo.features) {
        const props = feature.properties;
        if (props.type !== 'telegramUser') continue;
        const { telegramUserId, avatarUrl } = props;
        if (typeof telegramUserId === 'number' && typeof avatarUrl === 'string' && avatarUrl.length > 0) {
            result.set(telegramUserId, avatarUrl);
        }
    }
    return result;
}

/**
 * Загружает аватарки пользователей Telegram в Mapbox как именованные иконки.
 * Каждая иконка доступна по id `tg-avatar-<telegramUserId>`.
 * При смене geo-данных синхронизирует добавление/удаление иконок.
 */
export function useTelegramAvatars(map: MapboxMap | null, geo: FeatureCollection | null): void {
    const registeredRef = useRef(new Set<number>());

    useEffect(() => {
        if (!map) return;
        const mapInstance = map;

        const avatars = extractAvatars(geo);
        const toLoad: Array<{ id: number; url: string }> = [];

        for (const [id, url] of avatars) {
            if (!registeredRef.current.has(id)) {
                toLoad.push({ id, url });
            }
        }

        // Удаляем иконки пользователей, которых больше нет в данных
        for (const id of registeredRef.current) {
            if (!avatars.has(id)) {
                const imageId = `${AVATAR_PREFIX}${String(id)}`;
                if (mapInstance.hasImage(imageId)) mapInstance.removeImage(imageId);
                registeredRef.current.delete(id);
            }
        }

        for (const { id, url } of toLoad) {
            const imageId = `${AVATAR_PREFIX}${String(id)}`;
            loadImage(url)
                .then((img) => {
                    const imageData = drawCircularAvatar(img, AVATAR_SIZE);
                    if (!mapInstance.hasImage(imageId)) {
                        mapInstance.addImage(imageId, { width: AVATAR_SIZE, height: AVATAR_SIZE, data: new Uint8Array(imageData.data.buffer) }, { pixelRatio: 2 });
                    }
                    registeredRef.current.add(id);
                })
                .catch(() => {
                    // Не удалось загрузить аватар — останется circle-маркер
                });
        }
    }, [map, geo]);

    // При размонтировании чистим все зарегистрированные иконки
    useEffect(() => {
        return () => {
            if (!map) return;
            // eslint-disable-next-line react-hooks/exhaustive-deps -- нужно читать актуальное значение ref при unmount, не снапшот
            for (const id of registeredRef.current) {
                const imageId = `${AVATAR_PREFIX}${String(id)}`;
                if (map.hasImage(imageId)) map.removeImage(imageId);
            }
            registeredRef.current.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- map не меняется после монтирования; registeredRef.current читается намеренно при unmount
    }, []);
}

export { AVATAR_PREFIX };
