'use client'

import { useEffect, useRef, useState } from 'react'
import { MDXRemote, type MDXRemoteSerializeResult } from 'next-mdx-remote'
import { Loader2, AlertCircle } from 'lucide-react'
import { makeMdxComponents } from './mdx-components'
import type { AnnotationData } from '@/types'

interface MdxRichPreviewProps {
  content: string
  filePath: string
  annotations: AnnotationData[]
  owner: string
  repo: string
  gitRef: string
  onTextSelect: (selection: {
    text: string
    globalOffset: number
    contextBefore: string
    contextAfter: string
  }) => void
  onAnnotationClick: (id: string) => void
  activeAnnotationId?: string
}

export default function MdxRichPreview({
  content,
  filePath,
  annotations,
  owner,
  repo,
  gitRef,
  onTextSelect,
  onAnnotationClick,
  activeAnnotationId,
}: MdxRichPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [compiled, setCompiled] = useState<MDXRemoteSerializeResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Compile MDX whenever content changes
  useEffect(() => {
    if (!content) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch('/api/mdx/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, owner, repo, gitRef }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Compile failed')
          setCompiled(null)
        } else {
          setCompiled(data)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Network error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [content, owner, repo, gitRef])

  // Stable callback via ref so the document listener doesn't get re-registered.
  const onTextSelectRef = useRef(onTextSelect)
  useEffect(() => {
    onTextSelectRef.current = onTextSelect
  }, [onTextSelect])

  // Capture text selection on mouse release. One listener, no dedup — let
  // the parent handle duplicate state updates if they happen.
  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      // Ignore mouseups inside the comment popup / other overlays
      const target = e.target as Element | null
      if (target?.closest?.('[data-annotation-popup]')) return

      // Short delay so the browser finalizes the selection range
      setTimeout(() => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
        const container = contentRef.current
        if (!container) return

        const range = selection.getRangeAt(0)
        const selectedText = selection.toString().trim()
        if (!selectedText) return

        // Selection must intersect our content area
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

        onTextSelectRef.current({ text: selectedText, globalOffset, contextBefore, contextAfter })
      }, 10)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // Infer locale from file path so LocalizedImage picks the right srcMap key.
  // content/docs/zh/... → 'zh', content/docs/en/... → 'en', etc.
  const locale = filePath.match(/content\/docs\/([^/]+)\//)?.[1]
  const components = makeMdxComponents({ owner, repo, gitRef, locale })
  const frontmatter = (compiled?.frontmatter ?? {}) as Record<string, string>

  if (loading && !compiled) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <div className="text-sm font-medium mb-2">Rendering failed</div>
          <p className="text-xs text-gray-500 font-mono break-all">{error}</p>
          <p className="text-xs text-gray-400 mt-3">
            This file may have MDX syntax issues. Try opening a different file.
          </p>
        </div>
      </div>
    )
  }

  if (!compiled) return null

  return (
    <div className="flex-1 overflow-auto bg-background">
      {/* Wrapper holds the annotation-selectable area: hero + body */}
      <div ref={contentRef}>
        {/* Frontmatter hero */}
        {frontmatter.title && (
          <div className="border-b border-border bg-muted/30 px-8 py-6">
            <h1 className="text-3xl font-bold tracking-tight">{frontmatter.title}</h1>
            {frontmatter.description && (
              <p className="mt-2 text-base text-gray-500">{frontmatter.description}</p>
            )}
          </div>
        )}

        {/* Body content with MDX-specific typography */}
        <article className="mdx-preview mx-auto max-w-3xl px-8 py-6">
          <MDXRemote {...compiled} components={components} />
        </article>
      </div>

      {/* Annotation markers (reserved) */}
      {annotations.map((a, i) => (
        <button
          key={a.id}
          onClick={() => onAnnotationClick(a.id)}
          className={`fixed z-20 ${
            activeAnnotationId === a.id ? 'ring-2 ring-accent scale-110' : ''
          }`}
          style={{ display: 'none' }}
          title={a.comment}
        >
          <span className="annotation-badge">{i + 1}</span>
        </button>
      ))}
    </div>
  )
}
