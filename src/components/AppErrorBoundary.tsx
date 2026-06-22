import { Component, type ErrorInfo, type ReactNode } from 'react'
import { resetAppCache } from '@/utils/resetAppCache'

type Props = {
    children: ReactNode
}

type State = {
    hasError: boolean
    isResetting: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, isResetting: false }

    static getDerivedStateFromError(): Partial<State> {
        return { hasError: true }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Необработанная ошибка интерфейса карты:', error, errorInfo)
    }

    private handleReload = () => {
        window.location.reload()
    }

    private handleResetCache = () => {
        if (this.state.isResetting) return
        this.setState({ isResetting: true })
        void resetAppCache()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-dvh w-full items-center justify-center bg-neutral-100 p-6">
                    <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
                        <h2 className="text-lg font-semibold text-neutral-900">Ошибка интерфейса</h2>
                        <p className="mt-2 text-sm text-neutral-700">
                            Что-то пошло не так. Попробуйте перезагрузить страницу.
                        </p>
                        <button
                            type="button"
                            onClick={this.handleReload}
                            className="mt-4 cursor-pointer rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                        >
                            Перезагрузить
                        </button>
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={this.handleResetCache}
                                disabled={this.state.isResetting}
                                className="cursor-pointer text-xs text-neutral-400 transition hover:text-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {this.state.isResetting ? 'Очищаем кеш…' : 'Очистить кеш и перезагрузить'}
                            </button>
                        </div>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}
