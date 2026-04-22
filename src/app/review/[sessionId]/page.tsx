'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  Sparkles,
  Clipboard,
  Check,
  Loader2,
  GitCommit,
  ExternalLink,
  ChevronRight,
  FileOutput,
  Eye,
  Pencil,
  PanelLeft,
  PanelRight,
  RefreshCw,
  X,
} from 'lucide-react'
import MdxRichPreview from '@/components/MdxRichPreview'
import type { ImageAnnotationSelection } from '@/components/AnnotableImage'
import VercelPreview from '@/components/VercelPreview'
import AnnotationPanel from '@/components/AnnotationPanel'
import CommentPopup from '@/components/CommentPopup'
import DiffView from '@/components/DiffView'
import PRDescriptionModal from '@/components/PRDescriptionModal'
import AllFilesBrowser from '@/components/AllFilesBrowser'
import { generatePrompt } from '@/lib/prompt'
import { generatePRDescription } from '@/lib/summary'
import type { AnnotationData, PRFile } from '@/types'

interface SessionInfo {
  id: string
  owner: string
  repo: string
  prNumber: number
  branch: string
  headSha: string | null
  title: string | null
  prUrl: string
}

export default function ReviewPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [files, setFiles] = useState<PRFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [annotations, setAnnotations] = useState<AnnotationData[]>([])
  const [activeAnnotationId, setActiveAnnotationId] = useState<string>()
  const [pendingSelection, setPendingSelection] = useState<{
    text: string
    globalOffset: number
    contextBefore: string
    contextAfter: string
  } | null>(null)
  const [pendingImageSelection, setPendingImageSelection] = useState<ImageAnnotationSelection | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [diffData, setDiffData] = useState<{ original: string; fixed: string } | null>(null)
  const [commitLoading, setCommitLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState<null | {
    kind: 'up-to-date' | 'updated' | 'error'
    message: string
  }>(null)
  const [approvedChanges, setApprovedChanges] = useState<Map<string, string>>(new Map())
  const [showSummary, setShowSummary] = useState(false)
  const [summaryMarkdown, setSummaryMarkdown] = useState('')
  const [viewMode, setViewMode] = useState<'preview' | 'annotate'>('annotate')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [fileTab, setFileTab] = useState<'changed' | 'all'>('changed')
  const [allFiles, setAllFiles] = useState<Array<{ path: string; size: number; sha: string }>>([])
  const [allFilesLoading, setAllFilesLoading] = useState(false)
  // URL path currently displayed in the preview iframe (e.g., "/zh/admin/about")
  const [previewPagePath, setPreviewPagePath] = useState('')

  // Keyboard shortcuts: Cmd+B left, Cmd+Alt+B right
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'b') return
      e.preventDefault()
      if (e.altKey) setRightSidebarOpen((v) => !v)
      else setLeftSidebarOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const pollRef = useRef<ReturnType<typeof setInterval>>(null)

  // Load session info (works for any session, not just ones you created)
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(async (r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((s: SessionInfo | null) => {
        if (s) setSessionInfo(s)
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  // Load PR files
  useEffect(() => {
    if (!sessionInfo) return
    fetch(
      `/api/github/pr?owner=${sessionInfo.owner}&repo=${sessionInfo.repo}&number=${sessionInfo.prNumber}`
    )
      .then((r) => r.json())
      .then((data) => setFiles(data.files || []))
  }, [sessionInfo])

  // Lazy-load entire repo tree when All Files tab is first opened
  useEffect(() => {
    if (fileTab !== 'all' || !sessionInfo || allFiles.length > 0 || allFilesLoading) return
    setAllFilesLoading(true)
    const ref = sessionInfo.headSha || sessionInfo.branch
    fetch(
      `/api/github/tree?owner=${sessionInfo.owner}&repo=${sessionInfo.repo}&ref=${encodeURIComponent(ref)}`
    )
      .then((r) => r.json())
      .then((data) => setAllFiles(data.files || []))
      .finally(() => setAllFilesLoading(false))
  }, [fileTab, sessionInfo, allFiles.length, allFilesLoading])

  // Load annotations
  const loadAnnotations = useCallback(() => {
    fetch(`/api/annotations?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then(setAnnotations)
  }, [sessionId])

  useEffect(() => {
    loadAnnotations()
  }, [loadAnnotations])

  // Polling for real-time sync
  useEffect(() => {
    pollRef.current = setInterval(loadAnnotations, 8000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadAnnotations])

  // English is the default locale on this docs site — URLs drop the /en prefix.
  const DEFAULT_LOCALE = 'en'

  // Convert a doc file path to its URL path on the live Fumadocs site.
  // content/docs/en/pricing.mdx        → /docs/pricing        (default locale, no prefix)
  // content/docs/zh/pricing.mdx        → /zh/docs/pricing
  // content/docs/ja/admin/index.mdx    → /ja/docs/admin
  // content/docs/en/index.mdx          → /docs
  function filePathToUrlPath(path: string): string {
    const m = path.match(/content\/docs\/([^/]+)\/(.+)\.mdx?$/)
    if (!m) return '/'
    const locale = m[1]
    const rest = m[2].replace(/(?:^|\/)index$/, '')
    const localePrefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`
    return rest ? `${localePrefix}/docs/${rest}` : `${localePrefix}/docs`
  }

  // Reverse: given a URL path like /zh/docs/pricing or /docs/pricing,
  // find the matching MDX file.
  function urlPathToFilePath(urlPath: string): string | null {
    const clean = urlPath.replace(/^\/+/, '').replace(/\/+$/, '').split('?')[0].split('#')[0]
    if (!clean) return null

    const parts = clean.split('/')
    let locale: string
    let rest: string[]

    if (parts[0] === 'docs') {
      // /docs/... → default locale (English)
      locale = DEFAULT_LOCALE
      rest = parts.slice(1)
    } else if (parts.length >= 2 && parts[1] === 'docs') {
      // /{locale}/docs/... → specific locale
      locale = parts[0]
      rest = parts.slice(2)
    } else {
      // Fallback: treat first segment as locale
      locale = parts[0]
      rest = parts.slice(1)
    }

    const restJoined = rest.join('/')
    const slug = restJoined ? `${locale}/${restJoined}` : locale

    const candidates = [
      `content/docs/${slug}.mdx`,
      `content/docs/${slug}/index.mdx`,
      `content/docs/${slug}.md`,
      `content/docs/${slug}/index.md`,
    ]
    const pool = [...files.map((f) => f.filename), ...allFiles.map((f) => f.path)]
    for (const c of candidates) {
      if (pool.includes(c)) return c
    }
    return null
  }

  // Handle tab-switch: when going Preview → Annotate, sync file from previewPath
  function switchToAnnotate() {
    setViewMode('annotate')
    if (previewPagePath) {
      const matched = urlPathToFilePath(previewPagePath)
      if (matched && matched !== selectedFile) {
        loadFile(matched)
      }
    }
  }

  // Handle tab-switch: when going Annotate → Preview, sync URL from selectedFile
  function switchToPreview() {
    setViewMode('preview')
    if (selectedFile) {
      setPreviewPagePath(filePathToUrlPath(selectedFile))
    }
  }

  // Keep previewPagePath in sync when user selects a new file
  useEffect(() => {
    if (selectedFile) {
      setPreviewPagePath(filePathToUrlPath(selectedFile))
    }
  }, [selectedFile])

  // Load file content
  async function loadFile(filePath: string) {
    if (!sessionInfo) return
    setFileLoading(true)
    setSelectedFile(filePath)
    setDiffData(null)
    setFileError('')
    setFileContent('')
    try {
      // Prefer headSha (immutable) over branch name (can be deleted)
      const ref = sessionInfo.headSha || sessionInfo.branch
      const res = await fetch(
        `/api/github/pr?owner=${sessionInfo.owner}&repo=${sessionInfo.repo}&number=${sessionInfo.prNumber}&file=${encodeURIComponent(filePath)}&branch=${encodeURIComponent(ref)}`
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Failed to load file (${res.status})`)
      }
      const data = await res.json()
      setFileContent(data.content || '')
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Failed to load file')
    } finally {
      setFileLoading(false)
    }
  }

  // Create annotation
  async function createAnnotation(comment: string) {
    if (!pendingSelection || !selectedFile) return
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        type: 'text',
        filePath: selectedFile,
        selectedText: pendingSelection.text,
        globalOffset: pendingSelection.globalOffset,
        contextBefore: pendingSelection.contextBefore,
        contextAfter: pendingSelection.contextAfter,
        comment,
      }),
    })
    if (res.ok) {
      setPendingSelection(null)
      loadAnnotations()
    }
  }

  async function createImageAnnotation(comment: string) {
    if (!pendingImageSelection || !selectedFile) return
    const { src, alt, region } = pendingImageSelection
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        type: region ? 'area' : 'image',
        filePath: selectedFile,
        // Overload existing fields to store image info:
        //   selectedText = alt (so it shows nicely in panel)
        //   contextBefore = image src (used to render thumbnail)
        //   areaX/Y/Width/Height = region (normalized 0-1), only when region is set
        selectedText: alt || '',
        contextBefore: src,
        areaX: region?.x ?? null,
        areaY: region?.y ?? null,
        areaWidth: region?.w ?? null,
        areaHeight: region?.h ?? null,
        comment,
      }),
    })
    if (res.ok) {
      setPendingImageSelection(null)
      loadAnnotations()
    }
  }

  // Update annotation status
  async function updateStatus(id: string, status: string) {
    await fetch('/api/annotations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    loadAnnotations()
  }

  // Reply to annotation
  async function replyToAnnotation(id: string, comment: string) {
    await fetch('/api/annotations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reply: comment }),
    })
    loadAnnotations()
  }

  // Delete annotation
  async function deleteAnnotation(id: string) {
    await fetch('/api/annotations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadAnnotations()
  }

  // AI detect issues
  async function detectIssues() {
    if (!selectedFile || !fileContent) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fileContent,
          filePath: selectedFile,
          locale: selectedFile.match(/content\/docs\/(\w+)\//)?.[1],
        }),
      })
      const data = await res.json()
      if (data.issues?.length) {
        // Auto-create annotations from AI issues
        for (const issue of data.issues) {
          await fetch('/api/annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              type: 'text',
              filePath: selectedFile,
              selectedText: issue.originalText,
              sourceLine: issue.line,
              comment: `[AI ${issue.severity}] ${issue.description}\nSuggestion: ${issue.suggestion}`,
            }),
          })
        }
        loadAnnotations()
      }
    } finally {
      setAiLoading(false)
    }
  }

  // AI fix
  async function aiFixFile() {
    if (!selectedFile || !fileContent) return
    setAiLoading(true)
    try {
      const fileAnnotations = annotations.filter(
        (a) => a.filePath === selectedFile && (a.status === 'open' || a.status === 'done')
      )
      const res = await fetch('/api/ai/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fileContent,
          filePath: selectedFile,
          annotations: fileAnnotations.map((a) => ({
            sourceLine: a.sourceLine,
            selectedText: a.selectedText,
            comment: a.comment,
          })),
        }),
      })
      const data = await res.json()
      if (data.fixedContent) {
        setDiffData({ original: fileContent, fixed: data.fixedContent })
      }
    } finally {
      setAiLoading(false)
    }
  }

  // Copy a concise prompt with ALL open annotations across all files.
  // Intended to be pasted into Claude Code / Codex running in a workspace
  // that already has the docs repo checked out.
  function copyPrompt() {
    const prompt = generatePrompt(annotations)
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Approve diff
  function approveDiff() {
    if (!diffData || !selectedFile) return
    setApprovedChanges((prev) => new Map(prev).set(selectedFile, diffData.fixed))
    setDiffData(null)
  }

  // Generate PR description summary
  function generateSummary() {
    if (!sessionInfo) return
    const md = generatePRDescription({
      prUrl: sessionInfo.prUrl,
      owner: sessionInfo.owner,
      repo: sessionInfo.repo,
      prNumber: sessionInfo.prNumber,
      branch: sessionInfo.branch,
      title: sessionInfo.title,
      annotations,
      approvedFiles: Array.from(approvedChanges.keys()),
    })
    setSummaryMarkdown(md)
    setShowSummary(true)
  }

  // Commit approved changes
  // Refresh: re-fetch PR info from GitHub and update the session's headSha.
  // Also reloads the currently open file so its content reflects the new commit.
  async function refreshSession() {
    if (!sessionInfo || refreshing) return
    setRefreshing(true)
    setRefreshStatus(null)
    try {
      const res = await fetch(`/api/sessions/${sessionInfo.id}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Refresh failed')
      }
      setSessionInfo(data)

      if (data.headShaChanged) {
        setRefreshStatus({
          kind: 'updated',
          message: `Updated to ${String(data.headSha || '').slice(0, 7)}. Existing annotations preserved, but text positions may drift if code was edited.`,
        })
        // Reload the current file from the new commit
        if (selectedFile) await loadFile(selectedFile)
      } else {
        setRefreshStatus({
          kind: 'up-to-date',
          message: 'Already on the latest commit.',
        })
      }
    } catch (e) {
      setRefreshStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Refresh failed',
      })
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshStatus(null), 5000)
    }
  }

  async function commitChanges() {
    if (!sessionInfo || approvedChanges.size === 0) return
    setCommitLoading(true)
    try {
      const res = await fetch('/api/github/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: sessionInfo.owner,
          repo: sessionInfo.repo,
          branch: sessionInfo.branch,
          changes: Array.from(approvedChanges.entries()).map(([path, content]) => ({
            path,
            content,
          })),
          message: `docs: apply review fixes from Cherry Docs Reviewer\n\nSession: ${sessionId}`,
        }),
      })
      if (res.ok) {
        setApprovedChanges(new Map())
        alert('Changes committed successfully!')
      }
    } finally {
      setCommitLoading(false)
    }
  }

  const fileAnnotations = selectedFile
    ? annotations.filter((a) => a.filePath === selectedFile)
    : annotations

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!sessionInfo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Session not found</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Top bar */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-foreground transition"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={() => setLeftSidebarOpen((v) => !v)}
            className={`p-1 rounded hover:bg-muted transition ${
              leftSidebarOpen ? 'text-foreground' : 'text-gray-400'
            }`}
            title="Toggle file sidebar (⌘B)"
          >
            <PanelLeft size={16} />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-gray-500">
              {sessionInfo.owner}/{sessionInfo.repo}#{sessionInfo.prNumber}
            </span>
            <a
              href={sessionInfo.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-accent"
            >
              <ExternalLink size={12} />
            </a>
          </div>
          {sessionInfo.title && (
            <>
              <ChevronRight size={14} className="text-gray-300" />
              <span className="text-sm truncate max-w-xs">{sessionInfo.title}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshSession}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50 transition"
            title="Re-fetch the PR from GitHub — use this after the PR receives new commits"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={copyPrompt}
            disabled={annotations.filter((a) => a.status === 'open').length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-40 transition"
            title="Copy concise prompt of all open annotations — paste into Claude Code / Codex to apply fixes"
          >
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
          <button
            onClick={generateSummary}
            disabled={annotations.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-40 transition"
            title={
              annotations.length === 0
                ? 'Add annotations first'
                : 'Generate PR description summary'
            }
          >
            <FileOutput size={14} />
            Generate Summary
          </button>
          {approvedChanges.size > 0 && (
            <button
              onClick={commitChanges}
              disabled={commitLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
            >
              <GitCommit size={14} />
              {commitLoading ? 'Committing...' : `Commit ${approvedChanges.size} file(s)`}
            </button>
          )}
          <button
            onClick={() => setRightSidebarOpen((v) => !v)}
            className={`p-1 rounded hover:bg-muted transition ${
              rightSidebarOpen ? 'text-foreground' : 'text-gray-400'
            }`}
            title="Toggle annotations panel (⌘⌥B)"
          >
            <PanelRight size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* File sidebar */}
        {leftSidebarOpen && (
        <div className="w-64 border-r border-border overflow-auto shrink-0 flex flex-col">
          {/* Tab switcher */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setFileTab('changed')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                fileTab === 'changed'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-gray-500 hover:text-foreground'
              }`}
            >
              Changed ({files.length})
            </button>
            <button
              onClick={() => setFileTab('all')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                fileTab === 'all'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-gray-500 hover:text-foreground'
              }`}
            >
              All Files
            </button>
          </div>

          {/* All Files browser */}
          {fileTab === 'all' && (
            <div className="flex-1 overflow-auto">
              {allFilesLoading ? (
                <div className="p-4 text-xs text-gray-400 text-center">Loading...</div>
              ) : (
                <AllFilesBrowser
                  files={allFiles}
                  selectedFile={selectedFile}
                  annotationCountByFile={
                    new Map(
                      Object.entries(
                        annotations.reduce((acc, a) => {
                          acc[a.filePath] = (acc[a.filePath] ?? 0) + 1
                          return acc
                        }, {} as Record<string, number>)
                      )
                    )
                  }
                  onSelectFile={loadFile}
                />
              )}
            </div>
          )}

          {/* Changed files list */}
          {fileTab === 'changed' && (
            <div className="flex-1 overflow-auto">
          {files.map((f) => {
            const fileAnns = annotations.filter((a) => a.filePath === f.filename)
            const isMdx = f.filename.endsWith('.mdx') || f.filename.endsWith('.md')
            return (
              <button
                key={f.filename}
                onClick={() => isMdx && loadFile(f.filename)}
                disabled={!isMdx}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted transition border-b border-border/50 ${
                  selectedFile === f.filename ? 'bg-accent-light border-l-2 border-l-accent' : ''
                } ${!isMdx ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <FileText size={12} className="shrink-0 text-gray-400" />
                <span className="truncate font-mono">{f.filename.split('/').pop()}</span>
                <span
                  className={`ml-auto text-[10px] px-1 rounded ${
                    f.status === 'added'
                      ? 'bg-green-100 text-green-700'
                      : f.status === 'removed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {f.status === 'added' ? '+' : f.status === 'removed' ? '-' : 'M'}
                </span>
                {fileAnns.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">
                    {fileAnns.length}
                  </span>
                )}
              </button>
            )
          })}
            </div>
          )}
        </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFile ? (
            <>
              {/* File toolbar */}
              <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500">{selectedFile}</span>
                  {/* Preview / Annotate toggle */}
                  <div className="flex bg-background border border-border rounded-lg p-0.5 gap-0.5">
                    <button
                      onClick={switchToPreview}
                      className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition ${
                        viewMode === 'preview'
                          ? 'bg-accent text-white'
                          : 'text-gray-500 hover:text-foreground'
                      }`}
                      title="See the actual rendered docs site"
                    >
                      <Eye size={11} />
                      Preview
                    </button>
                    <button
                      onClick={switchToAnnotate}
                      className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition ${
                        viewMode === 'annotate'
                          ? 'bg-accent text-white'
                          : 'text-gray-500 hover:text-foreground'
                      }`}
                      title="Simplified view where you can select text to annotate"
                    >
                      <Pencil size={11} />
                      Annotate
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={detectIssues}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition"
                  >
                    <Sparkles size={12} />
                    {aiLoading ? 'Analyzing...' : 'AI Detect'}
                  </button>
                  <button
                    onClick={aiFixFile}
                    disabled={aiLoading || fileAnnotations.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-accent/10 text-accent rounded-lg hover:bg-accent/20 disabled:opacity-50 transition"
                  >
                    <Sparkles size={12} />
                    AI Fix
                  </button>
                </div>
              </div>

              {/* Diff view overlay */}
              {diffData && (
                <div className="p-4 bg-muted/50 border-b border-border">
                  <h3 className="text-sm font-semibold mb-2">AI-Generated Fix</h3>
                  <DiffView
                    original={diffData.original}
                    modified={diffData.fixed}
                    filePath={selectedFile}
                    onApprove={approveDiff}
                    onReject={() => setDiffData(null)}
                  />
                </div>
              )}

              {/* File content */}
              {viewMode === 'preview' ? (
                <VercelPreview
                  owner={sessionInfo.owner}
                  repo={sessionInfo.repo}
                  gitRef={sessionInfo.headSha || sessionInfo.branch}
                  pagePath={previewPagePath || filePathToUrlPath(selectedFile)}
                  onPagePathChange={setPreviewPagePath}
                />
              ) : fileLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : fileError ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="max-w-md text-center">
                    <div className="text-red-500 mb-2 text-sm font-medium">Failed to load file</div>
                    <div className="text-xs text-gray-500 mb-4 font-mono">{fileError}</div>
                    <p className="text-xs text-gray-400">
                      This usually happens if the PR branch was deleted after merging.
                      Try creating a new review session from this PR (we&apos;ll use the commit SHA instead of the branch).
                    </p>
                  </div>
                </div>
              ) : !fileContent ? (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                  File is empty
                </div>
              ) : (
                <MdxRichPreview
                  content={fileContent}
                  filePath={selectedFile}
                  annotations={fileAnnotations}
                  owner={sessionInfo.owner}
                  repo={sessionInfo.repo}
                  gitRef={sessionInfo.headSha || sessionInfo.branch}
                  onTextSelect={setPendingSelection}
                  onImageSelect={setPendingImageSelection}
                  onAnnotationClick={setActiveAnnotationId}
                  activeAnnotationId={activeAnnotationId}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a file to start reviewing
            </div>
          )}
        </div>

        {/* Annotation panel */}
        {rightSidebarOpen && (
          <AnnotationPanel
            annotations={fileAnnotations}
            activeId={activeAnnotationId}
            onSelect={setActiveAnnotationId}
            onStatusChange={updateStatus}
            onReply={replyToAnnotation}
            onDelete={deleteAnnotation}
            currentUserId={session?.user?.id}
          />
        )}
      </div>

      {/* Text comment popup */}
      {pendingSelection && (
        <CommentPopup
          selectedText={pendingSelection.text}
          onSubmit={createAnnotation}
          onCancel={() => setPendingSelection(null)}
        />
      )}

      {/* Image / region comment popup */}
      {pendingImageSelection && (
        <CommentPopup
          imageSelection={pendingImageSelection}
          onSubmit={createImageAnnotation}
          onCancel={() => setPendingImageSelection(null)}
        />
      )}

      {/* Refresh status toast */}
      {refreshStatus && (
        <div
          className={`fixed bottom-4 right-4 z-40 max-w-sm px-4 py-3 rounded-lg shadow-lg border text-sm ${
            refreshStatus.kind === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : refreshStatus.kind === 'updated'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="shrink-0">
              {refreshStatus.kind === 'updated' ? '🔄' : refreshStatus.kind === 'error' ? '⚠️' : '✓'}
            </span>
            <span className="flex-1">{refreshStatus.message}</span>
            <button
              onClick={() => setRefreshStatus(null)}
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* PR Description summary modal */}
      {showSummary && (
        <PRDescriptionModal
          markdown={summaryMarkdown}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  )
}
