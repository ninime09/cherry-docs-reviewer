'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches runtime errors in the descendant tree so a single bad MDX file
 * or component doesn't take down the whole review page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <div className="text-sm font-semibold mb-2">Rendering crashed</div>
            <div className="text-xs text-gray-500 font-mono break-all mb-3 whitespace-pre-wrap text-left bg-muted p-3 rounded">
              {this.state.error.message}
              {this.state.error.stack && (
                <details className="mt-2 text-[10px]">
                  <summary className="cursor-pointer text-gray-400">Stack trace</summary>
                  <pre className="mt-2 overflow-auto max-h-60">{this.state.error.stack}</pre>
                </details>
              )}
            </div>
            <button
              onClick={this.reset}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
