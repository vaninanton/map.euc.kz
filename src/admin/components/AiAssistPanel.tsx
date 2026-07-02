import { useEffect, useRef, useState } from 'react'
import { improveWithAi, type AiSuggestion } from '@/admin/lib/adminApi'
import { copyToClipboard } from '@/utils/shareLinks'
import { buildAiAssistPrompt, type AiAssistEntity } from '@/admin/utils/aiAssistPrompt'

interface AiAssistPanelProps {
    entity: AiAssistEntity
    onApply?: (suggestion: AiSuggestion) => void
}

/**
 * Панель «ИИ-помощник»: read-only промпт для улучшения названия/описания объекта
 * с кнопкой копирования (для ChatGPT/Claude вручную) и кнопкой «Улучшить с ИИ» —
 * вызов edge-функции ai-assist (OpenAI). Чекбокс «Искать в интернете» управляет
 * web-поиском (точки интереса, проверка фактов — медленнее).
 */
export function AiAssistPanel({ entity, onApply }: AiAssistPanelProps) {
    const [copied, setCopied] = useState(false)
    const [webSearch, setWebSearch] = useState(true)
    const [improving, setImproving] = useState(false)
    const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null)
    const [applied, setApplied] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const appliedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
            if (appliedTimerRef.current) clearTimeout(appliedTimerRef.current)
        }
    }, [])

    const prompt = buildAiAssistPrompt(entity, { webSearch })

    const handleCopy = async () => {
        const ok = await copyToClipboard(prompt)
        if (!ok) return
        setCopied(true)
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
        copiedTimerRef.current = setTimeout(() => {
            setCopied(false)
        }, 2500)
    }

    const handleImprove = async () => {
        setImproving(true)
        setAiError(null)
        setSuggestion(null)
        setApplied(false)
        try {
            setSuggestion(await improveWithAi(entity, webSearch))
        } catch (err) {
            setAiError(err instanceof Error ? err.message : String(err))
        } finally {
            setImproving(false)
        }
    }

    const handleApply = () => {
        if (!suggestion || !onApply) return
        onApply(suggestion)
        setSuggestion(null)
        setApplied(true)
        if (appliedTimerRef.current) clearTimeout(appliedTimerRef.current)
        appliedTimerRef.current = setTimeout(() => {
            setApplied(false)
        }, 5000)
    }

    return (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <h2 className="text-sm font-medium text-neutral-800">ИИ-помощник</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
                Нажмите «Улучшить с ИИ» или скопируйте промпт в ChatGPT/Claude, чтобы улучшить название и описание.
            </p>
            <textarea
                readOnly
                rows={8}
                value={prompt}
                className="mt-2 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
                <input
                    type="checkbox"
                    checked={webSearch}
                    onChange={(event) => {
                        setWebSearch(event.target.checked)
                    }}
                    className="h-4 w-4 rounded border-neutral-300 text-blue-600"
                />
                Искать в интернете (точки интереса, проверка фактов — медленнее)
            </label>
            <div className="mt-2 flex gap-2">
                {onApply && (
                    <button
                        type="button"
                        onClick={() => {
                            void handleImprove()
                        }}
                        disabled={improving}
                        className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        {improving ? 'Улучшаю…' : 'Улучшить с ИИ'}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => {
                        void handleCopy()
                    }}
                    className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                >
                    {copied ? 'Скопировано' : 'Скопировать промпт'}
                </button>
            </div>

            {aiError && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{aiError}</div>}

            {applied && (
                <div className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                    Подставлено в поля формы — проверьте и нажмите «Сохранить».
                </div>
            )}

            {suggestion && onApply && (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs font-medium text-neutral-500">Предложение ИИ</div>
                    <div className="mt-1 text-sm font-medium text-neutral-800">{suggestion.title}</div>
                    <div className="mt-1 text-sm whitespace-pre-wrap text-neutral-700">{suggestion.description}</div>
                    {suggestion.pois.length > 0 && (
                        <div className="mt-2">
                            <div className="text-xs font-medium text-neutral-500">Точки интереса рядом</div>
                            <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
                                {suggestion.pois.map((poi) => (
                                    <li key={poi}>{poi}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={handleApply}
                            className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            Применить
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSuggestion(null)
                            }}
                            className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                        >
                            Отклонить
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
