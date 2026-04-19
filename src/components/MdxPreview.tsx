'use client'

import { useCallback, useMemo, useRef } from 'react'
import type { AnnotationData } from '@/types'

interface MdxPreviewProps {
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

export default function MdxPreview({
  content,
  annotations,
  owner,
  repo,
  gitRef,
  onTextSelect,
  onAnnotationClick,
  activeAnnotationId,
}: MdxPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !contentRef.current) return

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString().trim()
    if (!selectedText) return

    const preRange = document.createRange()
    preRange.selectNodeContents(contentRef.current)
    preRange.setEnd(range.startContainer, range.startOffset)
    const globalOffset = preRange.toString().length

    const fullText = contentRef.current.textContent || ''
    const contextBefore = fullText.slice(Math.max(0, globalOffset - 40), globalOffset)
    const contextAfter = fullText.slice(
      globalOffset + selectedText.length,
      globalOffset + selectedText.length + 40
    )

    onTextSelect({ text: selectedText, globalOffset, contextBefore, contextAfter })
  }, [onTextSelect])

  const { html, frontmatter } = useMemo(
    () => renderMdx(content, { owner, repo, gitRef }),
    [content, owner, repo, gitRef]
  )

  return (
    <div className="flex-1 overflow-auto bg-background">
      {/* Frontmatter hero */}
      {frontmatter.title && (
        <div className="border-b border-border bg-muted/30 px-8 py-6">
          <h1 className="text-3xl font-bold tracking-tight">{frontmatter.title}</h1>
          {frontmatter.description && (
            <p className="mt-2 text-base text-gray-500">{frontmatter.description}</p>
          )}
        </div>
      )}

      {/* Main content */}
      <article
        ref={contentRef}
        className="mdx-preview mx-auto max-w-3xl px-8 py-6"
        onMouseUp={handleMouseUp}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Hidden annotation markers (for future positioning) */}
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

// ---------- Renderer ----------

interface RenderCtx {
  owner: string
  repo: string
  gitRef: string
}

function renderMdx(source: string, ctx: RenderCtx): { html: string; frontmatter: Record<string, string> } {
  let text = source

  // 1. Extract frontmatter
  const frontmatter: Record<string, string> = {}
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (fmMatch) {
    text = text.slice(fmMatch[0].length)
    fmMatch[1].split('\n').forEach((line) => {
      const m = line.match(/^(\w+):\s*(.+?)$/)
      if (m) frontmatter[m[1]] = m[2].replace(/^["']|["']$/g, '')
    })
  }

  // 2. Strip imports (single-line and multi-line)
  text = text.replace(/^import\s+[\s\S]+?from\s+['"][^'"]+['"];?\s*$/gm, '')
  text = text.replace(/^export\s+.*$/gm, '')

  // 3. Protect code blocks from component parsing
  const codeBlocks: string[] = []
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = codeBlocks.length
    codeBlocks.push(`<pre class="mdx-code"><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`)
    return `@@CODEBLOCK_${id}@@`
  })

  // 4. Replace JSX components (self-closing) — handles multi-line attributes
  text = text.replace(/<([A-Z]\w*)([^>]*?)\/>/g, (_, tag, attrs) => {
    return renderComponent(tag, parseProps(attrs), null, ctx)
  })

  // 5. Replace paired JSX components
  let previous = ''
  while (previous !== text) {
    previous = text
    text = text.replace(
      /<([A-Z]\w*)([^>]*?)>([\s\S]*?)<\/\1>/g,
      (_, tag, attrs, inner) => {
        const renderedInner = renderMarkdownInline(inner)
        return renderComponent(tag, parseProps(attrs), renderedInner, ctx)
      }
    )
  }

  // 6. Inline HTML (img, a, etc.) — resolve image src to GitHub raw URL
  text = text.replace(/<img\s+([^>]+)\/?>/g, (_, attrs) => {
    const props = parseProps(attrs)
    const src = resolveAssetUrl(props.src || '', ctx)
    const alt = escapeHtml(props.alt || '')
    return `<img src="${src}" alt="${alt}" class="mdx-image" />`
  })

  // 7. Block-level markdown
  const lines = text.split('\n')
  const out: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' = 'ul'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines (they break paragraphs below)
    if (trimmed === '') {
      if (inList) {
        out.push(`</${listType}>`)
        inList = false
      }
      continue
    }

    // Code block placeholder
    if (trimmed.match(/^@@CODEBLOCK_\d+@@$/)) {
      if (inList) { out.push(`</${listType}>`); inList = false }
      out.push(trimmed)
      continue
    }

    // Headings
    const h = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (h) {
      if (inList) { out.push(`</${listType}>`); inList = false }
      const level = h[1].length
      out.push(`<h${level}>${renderMarkdownInline(h[2])}</h${level}>`)
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      if (inList) { out.push(`</${listType}>`); inList = false }
      out.push(`<blockquote>${renderMarkdownInline(trimmed.slice(2))}</blockquote>`)
      continue
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) out.push(`</${listType}>`)
        out.push('<ul>')
        inList = true
        listType = 'ul'
      }
      out.push(`<li>${renderMarkdownInline(ulMatch[1])}</li>`)
      continue
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) out.push(`</${listType}>`)
        out.push('<ol>')
        inList = true
        listType = 'ol'
      }
      out.push(`<li>${renderMarkdownInline(olMatch[1])}</li>`)
      continue
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***') {
      if (inList) { out.push(`</${listType}>`); inList = false }
      out.push('<hr />')
      continue
    }

    // Pre-rendered component block (from earlier replacement)
    if (trimmed.startsWith('<div class="mdx-component')) {
      if (inList) { out.push(`</${listType}>`); inList = false }
      out.push(line)
      continue
    }

    // HTML img tag
    if (trimmed.startsWith('<img')) {
      if (inList) { out.push(`</${listType}>`); inList = false }
      out.push(line)
      continue
    }

    // Default: paragraph
    if (inList) { out.push(`</${listType}>`); inList = false }
    out.push(`<p>${renderMarkdownInline(trimmed)}</p>`)
  }

  if (inList) out.push(`</${listType}>`)

  let html = out.join('\n')

  // 8. Restore code blocks
  html = html.replace(/@@CODEBLOCK_(\d+)@@/g, (_, id) => codeBlocks[parseInt(id, 10)] || '')

  // 9. Resolve markdown-syntax images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<img src="${resolveAssetUrl(src, ctx)}" alt="${escapeHtml(alt)}" class="mdx-image" />`
  })

  return { html, frontmatter }
}

function renderMarkdownInline(text: string): string {
  return text
    // Inline code (protect first)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\b_(.+?)_\b/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent underline">$1</a>')
}

function parseProps(attrStr: string): Record<string, string> {
  const props: Record<string, string> = {}
  // Match key="value", key='value', or key={value}
  const regex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g
  let match
  while ((match = regex.exec(attrStr))) {
    props[match[1]] = match[2] ?? match[3] ?? match[4]
  }
  return props
}

function renderComponent(
  tag: string,
  props: Record<string, string>,
  children: string | null,
  ctx: RenderCtx
): string {
  // Special handling for image-like components
  if (tag === 'LocalizedImage' || tag === 'Image') {
    const src = resolveAssetUrl(props.src || '', ctx)
    const alt = escapeHtml(props.alt || '')
    return `<img src="${src}" alt="${alt}" class="mdx-image" />`
  }

  // Render generic component as a labeled block
  const propsHtml = Object.entries(props)
    .map(([k, v]) => {
      const val = escapeHtml(v)
      return `<div class="mdx-prop"><span class="mdx-prop-key">${k}</span><span class="mdx-prop-value">${val}</span></div>`
    })
    .join('')

  return `<div class="mdx-component">
    <div class="mdx-component-header"><span class="mdx-component-tag">${tag}</span></div>
    ${propsHtml ? `<div class="mdx-component-props">${propsHtml}</div>` : ''}
    ${children ? `<div class="mdx-component-children">${children}</div>` : ''}
  </div>`
}

function resolveAssetUrl(src: string, ctx: RenderCtx): string {
  if (!src) return ''
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  if (src.startsWith('data:')) return src

  // Paths starting with / are relative to /public in the docs repo
  const cleanPath = src.startsWith('/') ? `public${src}` : src
  return `https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${ctx.gitRef}/${cleanPath}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
