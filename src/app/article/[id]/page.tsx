'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, PanelRight, PanelRightClose } from 'lucide-react'
import AnnotationOverlay from '@/components/AnnotationOverlay'
import AnnotationPanel from '@/components/AnnotationPanel'
import CommentPopup from '@/components/CommentPopup'
import type { AnnotationData } from '@/types'

interface ArticleMeta {
  id: string
  slug: string
  title: string
  digest: string | null
  htmlSnapshot: string
  status: string
  source: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string | null; image: string | null }
  annotationCount: number
}

interface PendingSelection {
  text: string
  globalOffset: number
  contextBefore: string
  contextAfter: string
}

// All annotations on an article share a synthetic filePath. The panel groups
// by file but for articles there's only one body.
const ARTICLE_FILE_PATH = 'article'

export default function ArticlePage() {
  const params = useParams<{ id: string }>()
  const articleId = params?.id
  const { data: session, status: sessionStatus } = useSession()

  const [article, setArticle] = useState<ArticleMeta | null>(null)
  const [articleError, setArticleError] = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<AnnotationData[]>([])
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null)
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | undefined>()
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)

  const contentRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // --- Fetch article ---
  useEffect(() => {
    if (!articleId) return
    let cancelled = false
    fetch(`/api/articles/${encodeURIComponent(articleId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then((data: ArticleMeta) => {
        if (!cancelled) setArticle(data)
      })
      .catch((e: Error) => {
        if (!cancelled) setArticleError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [articleId])

  // --- Fetch + poll annotations ---
  const loadAnnotations = useCallback(() => {
    if (!article) return
    fetch(`/api/annotations?articleId=${article.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAnnotations(data)
      })
      .catch(() => {})
  }, [article])

  useEffect(() => {
    loadAnnotations()
  }, [loadAnnotations])

  useEffect(() => {
    const interval = setInterval(loadAnnotations, 8000)
    return () => clearInterval(interval)
  }, [loadAnnotations])

  // --- Text selection inside the article body ---
  // Mirrors the logic in MdxRichPreview so behavior stays consistent.
  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      const target = e.target as Element | null
      if (target?.closest?.('[data-annotation-popup]')) return

      setTimeout(() => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
        const container = contentRef.current
        if (!container) return

        const range = selection.getRangeAt(0)
        const selectedText = selection.toString().trim()
        if (!selectedText) return

        const startInside = container.contains(range.startContainer)
        const endInside = container.contains(range.endContainer)
        if (!startInside && !endInside) return

        const preRange = document.createRange()
        preRange.selectNodeContents(container)
        try {
          preRange.setEnd(range.startContainer, range.startOffset)
        } catch {
          return
        }
        const globalOffset = preRange.toString().length

        const fullText = container.textContent || ''
        const contextBefore = fullText.slice(Math.max(0, globalOffset - 40), globalOffset)
        const contextAfter = fullText.slice(
          globalOffset + selectedText.length,
          globalOffset + selectedText.length + 40
        )

        setPendingSelection({
          text: selectedText,
          globalOffset,
          contextBefore,
          contextAfter,
        })
      }, 10)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // --- Annotation CRUD ---
  async function createAnnotation(comment: string) {
    if (!pendingSelection || !article) return
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        type: 'text',
        filePath: ARTICLE_FILE_PATH,
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

  async function updateStatus(id: string, status: string) {
    await fetch('/api/annotations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    loadAnnotations()
  }

  async function replyToAnnotation(id: string, comment: string) {
    await fetch('/api/annotations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reply: comment }),
    })
    loadAnnotations()
  }

  async function deleteAnnotation(id: string) {
    await fetch('/api/annotations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadAnnotations()
  }

  // --- Render guards ---
  if (sessionStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center px-6">
        <h1 className="text-2xl font-semibold">Sign in to review this article</h1>
        <p className="text-muted-foreground">Cherry article reviewer requires a GitHub-authenticated account to annotate.</p>
        <a className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm" href="/api/auth/signin">Sign in with GitHub</a>
      </div>
    )
  }

  if (articleError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center px-6">
        <h1 className="text-xl font-semibold">Couldn&apos;t load article</h1>
        <p className="text-muted-foreground">{articleError}</p>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span>Article</span>
            <span>·</span>
            <span>{article.status.toLowerCase()}</span>
            {article.source && (
              <>
                <span>·</span>
                <span>{article.source}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 truncate text-lg font-semibold">{article.title}</h1>
          {article.digest && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{article.digest}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRightSidebarOpen((v) => !v)}
          className="ml-4 inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
          title={rightSidebarOpen ? 'Hide annotations panel' : 'Show annotations panel'}
        >
          {rightSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </button>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-8">
            <div
              ref={contentRef}
              className="cherry-article"
              // Article HTML is produced by cherry-wechat-publisher (trusted internal tool).
              // No <script>/<link>/<style> in the published surface; React's default
              // dangerouslySetInnerHTML won't execute scripts either.
              dangerouslySetInnerHTML={{ __html: article.htmlSnapshot }}
            />
          </div>
          <AnnotationOverlay
            annotations={annotations}
            contentRef={contentRef}
            scrollContainerRef={scrollContainerRef}
            onAnnotationClick={setActiveAnnotationId}
            activeAnnotationId={activeAnnotationId}
          />
        </div>

        {rightSidebarOpen && (
          <div className="w-[380px] shrink-0 border-l">
            <AnnotationPanel
              annotations={annotations}
              currentFilePath={ARTICLE_FILE_PATH}
              activeId={activeAnnotationId}
              onSelect={setActiveAnnotationId}
              onStatusChange={updateStatus}
              onReply={replyToAnnotation}
              onDelete={deleteAnnotation}
              currentUserId={session?.user?.id}
            />
          </div>
        )}
      </div>

      {pendingSelection && (
        <CommentPopup
          selectedText={pendingSelection.text}
          onSubmit={createAnnotation}
          onCancel={() => setPendingSelection(null)}
        />
      )}
    </div>
  )
}
