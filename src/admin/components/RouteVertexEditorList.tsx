import { useEffect, useRef, useState } from 'react'
import { removeVertexAtIndex, type RouteEditorCoordinates } from '@/admin/route-editor/routeGeometry'

interface RouteVertexEditorListProps {
    coordinates: RouteEditorCoordinates
    viaCoordinates: Array<[number, number]>
    /** Запись в историю undo и обновление состояния — как `commitRouteCoordinates` со страницы. */
    onCoordinatesChange: (next: RouteEditorCoordinates) => void
    onViaCoordinatesChange: (next: Array<[number, number]>) => void
    onSimplifyRoute: () => void
    onFillMissingElevations: () => void
    fillingElevations?: boolean
    highlightedIndex: number | null
    onValidationError: (message: string | null) => void
}

function coordSignature(coord: RouteEditorCoordinates[number]): string {
    return coord.length === 3
        ? `${String(coord[0])},${String(coord[1])},${String(coord[2])}`
        : `${String(coord[0])},${String(coord[1])}`
}

interface VertexRowProps {
    index: number
    coord: RouteEditorCoordinates[number]
    vertexCount: number
    highlighted: boolean
    assignRowRef: (index: number, node: HTMLDivElement | null) => void
    onCommit: (index: number, lngStr: string, latStr: string, eleRaw: string) => void
    isVia: boolean
    onToggleVia: (index: number, checked: boolean) => void
    onRemove: (index: number) => void
}

function VertexRow({
    index,
    coord,
    vertexCount,
    highlighted,
    assignRowRef,
    onCommit,
    isVia,
    onToggleVia,
    onRemove,
}: VertexRowProps) {
    const [lngStr, setLngStr] = useState(() => String(coord[0]))
    const [latStr, setLatStr] = useState(() => String(coord[1]))
    const [eleStr, setEleStr] = useState(() => (coord.length === 3 ? String(coord[2]) : ''))

    const rowNum = index + 1
    /** Ширины в ch: lng/lat — типичные градусы, h — высота; при необходимости горизонтальная прокрутка внутри поля. */
    const cellBase =
        'box-border shrink-0 overflow-x-auto rounded border border-neutral-300 bg-white px-1 py-0.5 text-right font-mono text-xs leading-tight tabular-nums'

    return (
        <div
            ref={(node) => {
                assignRowRef(index, node)
            }}
            className={`flex min-w-0 items-center gap-1 rounded border px-1 py-0.5 transition-colors ${
                highlighted ? 'border-amber-300 bg-amber-50' : 'border-neutral-200 bg-white'
            }`}
        >
            <span className="box-border w-[4ch] shrink-0 text-right font-mono text-xs tabular-nums leading-tight text-neutral-800">
                {rowNum}
            </span>
            <input
                value={lngStr}
                onChange={(e) => {
                    setLngStr(e.target.value)
                }}
                onBlur={() => {
                    onCommit(index, lngStr, latStr, eleStr)
                }}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`${String(rowNum)} lng`}
                className={`${cellBase} w-[11ch]`}
            />
            <input
                value={latStr}
                onChange={(e) => {
                    setLatStr(e.target.value)
                }}
                onBlur={() => {
                    onCommit(index, lngStr, latStr, eleStr)
                }}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`${String(rowNum)} lat`}
                className={`${cellBase} w-[11ch]`}
            />
            <input
                value={eleStr}
                onChange={(e) => {
                    setEleStr(e.target.value)
                }}
                onBlur={() => {
                    onCommit(index, lngStr, latStr, eleStr)
                }}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`${String(rowNum)} h`}
                className={`${cellBase} w-[7ch]`}
            />
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-700">
                <input
                    type="checkbox"
                    checked={isVia}
                    onChange={(event) => {
                        onToggleVia(index, event.target.checked)
                    }}
                    aria-label={`${String(rowNum)} промежуточная`}
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-blue-600"
                />
                via
            </label>
            <button
                type="button"
                disabled={vertexCount <= 2}
                onClick={() => {
                    onRemove(index)
                }}
                className="shrink-0 rounded px-0.5 py-0.5 font-mono text-sm leading-none text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
                aria-label={`Удалить вершину ${String(rowNum)}`}
            >
                ×
            </button>
        </div>
    )
}

export function RouteVertexEditorList({
    coordinates,
    viaCoordinates,
    onCoordinatesChange,
    onViaCoordinatesChange,
    onSimplifyRoute,
    onFillMissingElevations,
    fillingElevations = false,
    highlightedIndex,
    onValidationError,
}: RouteVertexEditorListProps) {
    const isSameLngLat = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1]

    const sortViaByRouteOrder = (nextVia: Array<[number, number]>): Array<[number, number]> => {
        const middleVertices = coordinates.slice(1, coordinates.length - 1).map((coord) => [coord[0], coord[1]] as [number, number])
        return middleVertices.filter((vertex) => nextVia.some((via) => isSameLngLat(via, vertex)))
    }

    const toggleVia = (index: number, checked: boolean) => {
        if (index <= 0 || index >= coordinates.length - 1) {
            onValidationError('Промежуточной может быть только внутренняя точка маршрута.')
            return
        }
        const coord = coordinates[index]
        const point: [number, number] = [coord[0], coord[1]]
        if (checked) {
            if (viaCoordinates.some((via) => isSameLngLat(via, point))) {
                onValidationError(null)
                return
            }
            onViaCoordinatesChange(sortViaByRouteOrder([...viaCoordinates, point]))
        } else {
            onViaCoordinatesChange(sortViaByRouteOrder(viaCoordinates.filter((via) => !isSameLngLat(via, point))))
        }
        onValidationError(null)
    }

    const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())

    const assignRowRef = (index: number, node: HTMLDivElement | null) => {
        if (node) rowRefs.current.set(index, node)
        else rowRefs.current.delete(index)
    }

    useEffect(() => {
        if (highlightedIndex === null) return
        const el = rowRefs.current.get(highlightedIndex)
        el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    }, [highlightedIndex])

    const commitVertex = (index: number, lngInput: string, latInput: string, eleRaw: string) => {
        const lng = Number(lngInput.trim())
        const lat = Number(latInput.trim())
        const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180
        const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90
        if (!lngOk || !latOk) {
            onValidationError('Долгота и широта должны быть числами в допустимых пределах.')
            return
        }

        const eleTrimmed = eleRaw.trim()
        let nextTuple: RouteEditorCoordinates[number]
        if (eleTrimmed !== '') {
            const ele = Number(eleTrimmed)
            if (!Number.isFinite(ele)) {
                onValidationError('Высота должна быть числом или пустым полем.')
                return
            }
            nextTuple = [lng, lat, ele]
        } else {
            nextTuple = [lng, lat]
        }

        const prev = coordinates[index]

        const unchanged =
            prev.length === nextTuple.length &&
            prev[0] === nextTuple[0] &&
            prev[1] === nextTuple[1] &&
            (prev.length === 2 || (nextTuple.length === 3 && prev[2] === nextTuple[2]))

        if (unchanged) {
            onValidationError(null)
            return
        }

        const next = [...coordinates]
        next[index] = nextTuple
        onCoordinatesChange(next)
        onValidationError(null)
    }

    const removeAt = (index: number) => {
        onCoordinatesChange(removeVertexAtIndex(coordinates, index))
        onValidationError(null)
    }

    return (
        <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-neutral-700">Точки маршрута</label>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={coordinates.length <= 2 || fillingElevations}
                        onClick={() => {
                            onSimplifyRoute()
                        }}
                        className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Удалить промежуточные вершины, лежащие на прямой между соседями"
                    >
                        Упростить маршрут
                    </button>
                    <button
                        type="button"
                        disabled={fillingElevations}
                        onClick={() => {
                            onFillMissingElevations()
                        }}
                        className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Заполнить высоту у точек, где она отсутствует"
                    >
                        {fillingElevations ? 'Заполнение…' : 'Заполнить высоты'}
                    </button>
                </div>
            </div>
            <div className="max-h-96 min-h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-1.5">
                <div className="flex flex-col gap-1">
                    {coordinates.map((coord, index) => (
                        /* via привязан к координате вершины (lng/lat) */
                        <VertexRow
                            key={`${String(index)}-${coordSignature(coord)}`}
                            index={index}
                            coord={coord}
                            vertexCount={coordinates.length}
                            highlighted={highlightedIndex === index}
                            assignRowRef={assignRowRef}
                            onCommit={(i, lngN, latN, eleS) => {
                                commitVertex(i, lngN, latN, eleS)
                            }}
                            isVia={viaCoordinates.some((via) => isSameLngLat(via, [coord[0], coord[1]]))}
                            onToggleVia={toggleVia}
                            onRemove={removeAt}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
