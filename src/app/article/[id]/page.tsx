'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, PanelRight, ArrowLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AnnotationOverlay from '@/components/AnnotationOverlay'
import AnnotationPanel from '@/components/AnnotationPanel'
import CommentPopup from '@/components/CommentPopup'
import type { ImageAnnotationSelection } from '@/components/AnnotableImage'
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
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()

  const [article, setArticle] = useState<ArticleMeta | null>(null)
  const [articleError, setArticleError] = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<AnnotationData[]>([])
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null)
  const [pendingImageSelection, setPendingImageSelection] = useState<ImageAnnotationSelection | null>(null)
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

  // --- Image click → image annotation (MVP: whole image; no region selection yet) ---
  // The article HTML is injected via dangerouslySetInnerHTML, so we can't use
  // <AnnotableImage>. Instead we walk the rendered DOM after each render and
  // attach a lightweight click handler to every <img>. AnnotationOverlay needs
  // data-annotation-image to find the image for positioning the badge.
  useEffect(() => {
    const container = contentRef.current
    if (!container || !article) return

    const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'))

    function makeHandler(img: HTMLImageElement) {
      return (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setPendingImageSelection({
          src: img.src,
          alt: img.alt || undefined,
          region: null,
        })
      }
    }

    const cleanups: Array<() => void> = []
    for (const img of imgs) {
      img.style.cursor = 'pointer'
      if (!img.dataset.annotationImage) img.dataset.annotationImage = img.src
      const handler = makeHandler(img)
      img.addEventListener('click', handler)
      cleanups.push(() => {
        img.removeEventListener('click', handler)
        img.style.cursor = ''
      })
    }

    return () => {
      for (const c of cleanups) c()
    }
  }, [article])

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

  async function createImageAnnotation(comment: string) {
    if (!pendingImageSelection || !article) return
    const { src, alt, region } = pendingImageSelection
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        type: region ? 'area' : 'image',
        filePath: ARTICLE_FILE_PATH,
        // Match review-page convention: alt -> selectedText, src -> contextBefore.
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
      {/* Top bar — single-line breadcrumb, matches /review/[sessionId] style */}
      <header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/articles')}
            className="text-gray-400 hover:text-foreground transition shrink-0"
            title="Back to articles"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="font-mono text-gray-500 shrink-0">article/{article.slug.slice(0, 24)}{article.slug.length > 24 ? '…' : ''}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider shrink-0 ${
                article.status === 'REVIEWING'
                  ? 'bg-yellow-100 text-yellow-800'
                  : article.status === 'APPROVED'
                    ? 'bg-green-100 text-green-800'
                    : article.status === 'PUBLISHED'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-500'
              }`}
            >
              {article.status}
            </span>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
            <span className="truncate">{article.title}</span>
          </div>
        </div>
        <button
          onClick={() => setRightSidebarOpen((v) => !v)}
          className={`p-1 rounded hover:bg-muted transition shrink-0 ${
            rightSidebarOpen ? 'text-foreground' : 'text-gray-400'
          }`}
          title="Toggle annotations panel"
        >
          <PanelRight size={16} />
        </button>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto bg-neutral-100 dark:bg-neutral-900">
          <div className="mx-auto max-w-2xl px-4 py-8">
            {/* Light surface — publisher HTML uses inline color:#27282d / #464646 etc
                designed for a white background. Forcing a white container avoids the
                "dark theme + dark text = unreadable" problem from the original report. */}
            <div className="rounded-lg bg-white text-neutral-900 shadow-sm">
              <div
                ref={contentRef}
                className="cherry-article px-4 py-6 [&_img]:max-w-full [&_img]:h-auto"
                // htmlSnapshot is server-side sanitized (sanitizeArticleHtml strips
                // shell <script>/<style>/<link> and extracts #content innerHTML).
                dangerouslySetInnerHTML={{ __html: article.htmlSnapshot }}
              />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              划选文字 / 点击图片 即可批注
            </p>
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

      {pendingImageSelection && (
        <CommentPopup
          imageSelection={pendingImageSelection}
          onSubmit={createImageAnnotation}
          onCancel={() => setPendingImageSelection(null)}
        />
      )}
    </div>
  )
}
