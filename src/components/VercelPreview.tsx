'use client'

import { useState, useEffect, useRef } from 'react'
import { ExternalLink, Loader2, AlertCircle, RefreshCw, Pencil } from 'lucide-react'

interface PreviewInfo {
  url: string | null
  state: 'pending' | 'in_progress' | 'success' | 'failure' | 'error' | 'none'
  environment: string | null
}

interface VercelPreviewProps {
  owner: string
  repo: string
  gitRef: string  // branch name or SHA
  pagePath: string  // current URL path like "/zh/admin/about"
  onPagePathChange: (path: string) => void
}

export default function VercelPreview({
  owner,
  repo,
  gitRef,
  pagePath,
  onPagePathChange,
}: VercelPreviewProps) {
  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingPath, setEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState(pagePath)
  const [navigated, setNavigated] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const firstLoadRef = useRef(true)

  async function fetchPreview() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/github/preview?owner=${owner}&repo=${repo}&ref=${encodeURIComponent(gitRef)}`
      )
      const data = await res.json()
      setPreview(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPreview()
  }, [owner, repo, gitRef])

  useEffect(() => {
    setPathInput(pagePath)
    // Reset navigation flag when we explicitly change path
    firstLoadRef.current = true
    setNavigated(false)
  }, [pagePath])

  useEffect(() => {
    if (editingPath) inputRef.current?.select()
  }, [editingPath])

  function commitPathEdit() {
    let p = pathInput.trim()
    // Strip the base URL if user pasted the full URL
    if (preview?.url && p.startsWith(preview.url)) {
      p = p.slice(preview.url.length)
    } else if (p.match(/^https?:\/\//)) {
      // Full URL but doesn't match our preview domain — keep only the path
      try {
        p = new URL(p).pathname
      } catch {
        /* ignore */
      }
    }
    if (!p.startsWith('/')) p = '/' + p
    onPagePathChange(p)
    setEditingPath(false)
  }

  // Poll every 15s if deployment is still building
  useEffect(() => {
    if (preview?.state === 'pending' || preview?.state === 'in_progress') {
      const timer = setInterval(fetchPreview, 15000)
      return () => clearInterval(timer)
    }
  }, [preview?.state])

  if (loading && !preview) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!preview || preview.state === 'none') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <div className="text-sm font-medium mb-2">No preview deployment found</div>
          <p className="text-xs text-gray-500 mb-4">
            Make sure Vercel is connected to this repository and has built this branch.
          </p>
          <button
            onClick={fetchPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition"
          >
            <RefreshCw size={12} />
            Check again
          </button>
        </div>
      </div>
    )
  }

  if (preview.state === 'pending' || preview.state === 'in_progress') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
          <div className="text-sm font-medium mb-1">Deployment is building...</div>
          <p className="text-xs text-gray-500">
            {preview.state === 'in_progress' ? 'In progress' : 'Queued'} — polling every 15s
          </p>
        </div>
      </div>
    )
  }

  if (preview.state === 'failure' || preview.state === 'error' || !preview.url) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <div className="text-sm font-medium mb-2">Deployment failed</div>
          <p className="text-xs text-gray-500 mb-4">
            Check the Vercel dashboard for build errors, then refresh.
          </p>
          <button
            onClick={fetchPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>
    )
  }

  const fullUrl = preview.url + pagePath

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Preview toolbar */}
      <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center gap-2 shrink-0 text-xs">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="text-gray-500 shrink-0">URL:</span>

        {editingPath ? (
          <input
            ref={inputRef}
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onBlur={commitPathEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitPathEdit()
              if (e.key === 'Escape') {
                setPathInput(pagePath)
                setEditingPath(false)
              }
            }}
            placeholder="/zh/admin/about"
            className="flex-1 px-2 py-0.5 border border-accent rounded font-mono text-xs bg-background focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingPath(true)}
            className="flex-1 text-left font-mono text-gray-600 truncate hover:text-foreground transition flex items-center gap-1 group"
            title="Click to edit URL path"
          >
            <span className="truncate">{fullUrl}</span>
            <Pencil size={10} className="shrink-0 text-gray-300 group-hover:text-accent transition" />
          </button>
        )}

        <button
          onClick={fetchPreview}
          className="text-gray-400 hover:text-foreground transition shrink-0"
          title="Refresh preview info"
        >
          <RefreshCw size={12} />
        </button>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-gray-500 hover:text-accent transition shrink-0"
        >
          Open <ExternalLink size={11} />
        </a>
      </div>

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={fullUrl}
        className="flex-1 w-full border-0"
        title="Vercel Preview"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        onLoad={() => {
          // First load is our own src change; subsequent loads mean user
          // clicked something inside the iframe.
          if (firstLoadRef.current) {
            firstLoadRef.current = false
          } else {
            setNavigated(true)
          }
        }}
      />

      {/* Hint / navigation warning */}
      {navigated ? (
        <div className="px-3 py-2 border-t border-yellow-200 bg-yellow-50 text-xs text-yellow-800 shrink-0 flex items-center justify-between gap-2">
          <span className="flex-1">
            ⚠️ You navigated inside the iframe. We can&apos;t detect where you went due to
            browser security. If you want to annotate the current page,
            right-click the iframe area and copy the URL, or use the docs site&apos;s
            own URL bar, then paste into the URL field above.
          </span>
          <button
            onClick={() => setNavigated(false)}
            className="text-yellow-700 underline shrink-0 hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="px-3 py-1 border-t border-border bg-muted/30 text-[10px] text-gray-400 shrink-0">
          💡 Browser security prevents us from auto-detecting navigation inside the iframe.
          If you clicked around, paste the current URL above, then switch to Annotate to open that file.
        </div>
      )}
    </div>
  )
}
