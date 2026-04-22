'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AnnotationData } from '@/types'

// Find the <img> element for an image/area annotation. Tries exact src match
// first (fast path), then falls back to matching by URL pathname — this keeps
// annotations working when the session's gitRef drifts (branch → commit SHA).
function findAnnotationImage(
  content: HTMLElement,
  storedSrc: string
): HTMLImageElement | null {
  const exact = content.querySelector<HTMLImageElement>(
    `img[data-annotation-image="${CSS.escape(storedSrc)}"]`
  )
  if (exact) return exact

  let storedPath: string | null = null
  try {
    storedPath = new URL(storedSrc).pathname
  } catch {
    return null
  }
  const all = content.querySelectorAll<HTMLImageElement>('img[data-annotation-image]')
  for (const el of Array.from(all)) {
    const src = el.getAttribute('data-annotation-image') || ''
    try {
      if (new URL(src).pathname === storedPath) return el
    } catch {
      // ignore
    }
  }
  return null
}

type RectPos = { top: number; left: number; width: number; height: number }

interface TextPos extends RectPos {
  kind: 'text'
}
interface ImagePos extends RectPos {
  kind: 'image'
}
interface AreaPos extends RectPos {
  kind: 'area'
  regionTop: number
  regionLeft: number
  regionWidth: number
  regionHeight: number
}

type AnyPos = TextPos | ImagePos | AreaPos

const STATUS_COLOR: Record<string, { highlight: string; badge: string; ring: string }> = {
  open: {
    highlight: 'bg-yellow-300/40',
    badge: 'bg-red-500 text-white',
    ring: 'ring-yellow-400',
  },
  done: {
    highlight: 'bg-green-300/30',
    badge: 'bg-green-600 text-white',
    ring: 'ring-green-400',
  },
  resolved: {
    highlight: 'bg-gray-300/25',
    badge: 'bg-gray-500 text-white',
    ring: 'ring-gray-400',
  },
  wontfix: {
    highlight: 'bg-red-300/25',
    badge: 'bg-red-400 text-white line-through',
    ring: 'ring-red-300',
  },
}

interface Props {
  annotations: AnnotationData[]
  /** Ref to the element that contains the MDX content */
  contentRef: React.RefObject<HTMLElement | null>
  /** Ref to the scroll container (used for scrollIntoView) */
  scrollContainerRef?: React.RefObject<HTMLElement | null>
  onAnnotationClick: (id: string) => void
  activeAnnotationId?: string
}

export default function AnnotationOverlay({
  annotations,
  contentRef,
  scrollContainerRef,
  onAnnotationClick,
  activeAnnotationId,
}: Props) {
  const [positions, setPositions] = useState<Map<string, AnyPos>>(new Map())
  const [version, setVersion] = useState(0) // bump to force recompute (on scroll/resize/img load)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Recompute positions whenever annotations, content, or layout changes
  useLayoutEffect(() => {
    const content = contentRef.current
    const overlay = overlayRef.current
    if (!content || !overlay) return

    const overlayRect = overlay.getBoundingClientRect()
    const newPositions = new Map<string, AnyPos>()

    // --- Build one linear walk of text nodes for all text annotations ---
    const textAnnotations = annotations.filter(
      (a) => a.type === 'text' && a.globalOffset != null
    )
    if (textAnnotations.length > 0) {
      const sorted = [...textAnnotations].sort(
        (a, b) => (a.globalOffset ?? 0) - (b.globalOffset ?? 0)
      )
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
      const nodes: { node: Text; start: number; end: number }[] = []
      let offset = 0
      let n: Node | null
      while ((n = walker.nextNode())) {
        const txt = n as Text
        const len = txt.data.length
        nodes.push({ node: txt, start: offset, end: offset + len })
        offset += len
      }

      for (const a of sorted) {
        const start = a.globalOffset ?? 0
        const selLen = a.selectedText?.length ?? 0
        const end = start + selLen

        const startEntry = nodes.find((e) => e.end > start)
        const endEntry = nodes.find((e) => e.end >= end) ?? startEntry
        if (!startEntry || !endEntry) continue

        try {
          const range = document.createRange()
          range.setStart(startEntry.node, Math.max(0, start - startEntry.start))
          range.setEnd(endEntry.node, Math.max(0, Math.min(endEntry.end, end) - endEntry.start))
          const rect = range.getBoundingClientRect()
          if (rect.width === 0 && rect.height === 0) continue
          newPositions.set(a.id, {
            kind: 'text',
            top: rect.top - overlayRect.top,
            left: rect.left - overlayRect.left,
            width: rect.width,
            height: rect.height,
          })
        } catch {
          // range can throw on weird offsets — skip
        }
      }
    }

    // --- Image + area annotations: find by src (with pathname fallback) ---
    const imageAnnotations = annotations.filter(
      (a) => (a.type === 'image' || a.type === 'area') && a.contextBefore
    )
    for (const a of imageAnnotations) {
      const src = a.contextBefore
      if (!src) continue
      const img = findAnnotationImage(content, src)
      if (!img) continue
      const rect = img.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue

      const base: RectPos = {
        top: rect.top - overlayRect.top,
        left: rect.left - overlayRect.left,
        width: rect.width,
        height: rect.height,
      }

      if (
        a.type === 'area' &&
        a.areaX != null &&
        a.areaY != null &&
        a.areaWidth != null &&
        a.areaHeight != null
      ) {
        newPositions.set(a.id, {
          kind: 'area',
          ...base,
          regionTop: base.top + a.areaY * base.height,
          regionLeft: base.left + a.areaX * base.width,
          regionWidth: a.areaWidth * base.width,
          regionHeight: a.areaHeight * base.height,
        })
      } else {
        newPositions.set(a.id, { kind: 'image', ...base })
      }
    }

    setPositions(newPositions)
  }, [annotations, contentRef, version])

  // Trigger recompute on scroll / resize / image load.
  // MDX recompiles replace <img> elements in place, so we also watch the
  // content subtree for added images and hook their load events.
  useEffect(() => {
    const scroll = scrollContainerRef?.current ?? window
    const bump = () => setVersion((v) => v + 1)
    scroll.addEventListener('scroll', bump, { passive: true } as AddEventListenerOptions)
    window.addEventListener('resize', bump)

    const content = contentRef.current
    const hooked = new WeakSet<HTMLImageElement>()
    function hookImg(img: HTMLImageElement) {
      if (hooked.has(img)) return
      hooked.add(img)
      if (img.complete) {
        // Already loaded — just bump once so positions pick it up.
        bump()
      } else {
        img.addEventListener('load', bump)
      }
    }

    if (content) {
      content.querySelectorAll('img').forEach(hookImg)
    }

    const observer = content
      ? new MutationObserver((mutations) => {
          for (const m of mutations) {
            m.addedNodes.forEach((n) => {
              if (n instanceof HTMLImageElement) {
                hookImg(n)
              } else if (n instanceof HTMLElement) {
                n.querySelectorAll('img').forEach(hookImg)
              }
            })
          }
        })
      : null
    if (observer && content) {
      observer.observe(content, { childList: true, subtree: true })
    }

    return () => {
      scroll.removeEventListener('scroll', bump)
      window.removeEventListener('resize', bump)
      observer?.disconnect()
      // Listeners attached via hookImg will be GC'd with the elements.
    }
  }, [scrollContainerRef, contentRef])

  // Scroll active annotation into view.
  //
  // We resolve the target element lazily from the DOM (not from `positions`)
  // so the scroll still fires even when MDX was just recompiled and the
  // positions map hasn't been recomputed yet for the new elements. A pending
  // ref keeps retrying until the target is resolvable (e.g. once the image
  // finishes loading and has non-zero size), after which it clears so later
  // version bumps from user scrolling don't snap us back.
  const pendingScrollRef = useRef<string | null>(null)

  useEffect(() => {
    if (activeAnnotationId) pendingScrollRef.current = activeAnnotationId
  }, [activeAnnotationId])

  const tryScrollToAnnotation = useCallback(() => {
    const pending = pendingScrollRef.current
    if (!pending) return
    const a = annotations.find((x) => x.id === pending)
    if (!a) return
    const content = contentRef.current
    const scroll = scrollContainerRef?.current
    if (!content || !scroll) return

    const scrollRect = scroll.getBoundingClientRect()
    // The y we want the target to land at, relative to scroll container top.
    // Using clientHeight/3 keeps it visible but leaves room for context above.
    const desiredY = scroll.clientHeight / 3

    function scrollSoThatViewportY(viewportY: number) {
      const delta = viewportY - (scrollRect.top + desiredY)
      const target = Math.max(0, scroll!.scrollTop + delta)
      scroll!.scrollTo({ top: target, behavior: 'smooth' })
    }

    // --- Text annotation: build a range and scroll to its top ---
    if (a.type === 'text' && a.globalOffset != null && a.selectedText) {
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
      let offset = 0
      let startNode: Text | null = null
      let startNodeOffset = 0
      const target = a.globalOffset
      let n: Node | null
      while ((n = walker.nextNode())) {
        const txt = n as Text
        if (offset + txt.data.length > target) {
          startNode = txt
          startNodeOffset = target - offset
          break
        }
        offset += txt.data.length
      }
      if (!startNode) return
      try {
        const range = document.createRange()
        range.setStart(startNode, Math.max(0, Math.min(startNode.data.length, startNodeOffset)))
        range.setEnd(startNode, Math.max(0, Math.min(startNode.data.length, startNodeOffset)))
        const rect = range.getBoundingClientRect()
        if (rect.top === 0 && rect.bottom === 0) return
        scrollSoThatViewportY(rect.top)
        pendingScrollRef.current = null
      } catch {
        // skip — invalid range
      }
      return
    }

    // --- Image / area annotation: scroll to the image (or region center) ---
    if ((a.type === 'image' || a.type === 'area') && a.contextBefore) {
      const img = findAnnotationImage(content, a.contextBefore)
      if (!img) return
      const rect = img.getBoundingClientRect()
      // Zero-sized image means still loading — retry on next positions update.
      if (rect.width === 0 && rect.height === 0) return

      let targetViewportY = rect.top
      if (
        a.type === 'area' &&
        a.areaY != null &&
        a.areaHeight != null
      ) {
        // Center the region in view instead of the image top.
        targetViewportY =
          rect.top + (a.areaY + a.areaHeight / 2) * rect.height - desiredY
      }
      scrollSoThatViewportY(targetViewportY)
      pendingScrollRef.current = null
    }
  }, [annotations, contentRef, scrollContainerRef])

  // Try to fulfill the pending scroll when: the active annotation changes,
  // positions get recomputed (images loaded / layout changed), or annotations
  // list updates. Idempotent — once pending clears, later calls noop.
  useEffect(() => {
    tryScrollToAnnotation()
  }, [activeAnnotationId, positions, tryScrollToAnnotation])

  // Stable ordinal based on the annotation's position in the full list
  const ordinalById = new Map<string, number>()
  annotations.forEach((a, i) => ordinalById.set(a.id, i + 1))

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden
    >
      {annotations.map((a) => {
        const pos = positions.get(a.id)
        if (!pos) return null
        const ordinal = ordinalById.get(a.id) ?? 0
        const colors = STATUS_COLOR[a.status] ?? STATUS_COLOR.open
        const isActive = activeAnnotationId === a.id

        // Highlight layer
        const highlights: React.ReactNode[] = []
        if (pos.kind === 'text') {
          highlights.push(
            <div
              key={`hl-${a.id}`}
              className={`absolute rounded-sm ${colors.highlight} ${
                isActive ? `ring-2 ${colors.ring} animate-pulse` : ''
              }`}
              style={{
                top: pos.top - 1,
                left: pos.left - 1,
                width: pos.width + 2,
                height: pos.height + 2,
              }}
            />
          )
        } else if (pos.kind === 'area') {
          highlights.push(
            <div
              key={`hl-${a.id}`}
              className={`absolute border-2 ${colors.highlight} ${
                isActive ? `ring-2 ${colors.ring} animate-pulse` : ''
              }`}
              style={{
                top: pos.regionTop,
                left: pos.regionLeft,
                width: pos.regionWidth,
                height: pos.regionHeight,
                borderColor: 'currentColor',
              }}
            />
          )
        } else if (pos.kind === 'image') {
          // Idle: no decoration (badge is enough). Active: solid accent ring
          // so it's immediately obvious which image the annotation is on.
          highlights.push(
            <div
              key={`hl-${a.id}`}
              className={`absolute rounded pointer-events-none ${
                isActive
                  ? 'ring-4 ring-accent ring-offset-2 ring-offset-background animate-pulse'
                  : ''
              }`}
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                height: pos.height,
              }}
            />
          )
        }

        // Badge position: top-right corner of the element
        const badgeTop =
          pos.kind === 'area'
            ? pos.regionTop - 10
            : pos.top - 10
        const badgeLeft =
          pos.kind === 'area'
            ? pos.regionLeft + pos.regionWidth - 10
            : pos.left + pos.width - 10

        return (
          <div key={a.id}>
            {highlights}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAnnotationClick(a.id)
              }}
              className={`absolute pointer-events-auto rounded-full text-[10px] font-bold flex items-center justify-center shadow hover:scale-110 transition ${colors.badge} ${
                isActive ? 'scale-125 ring-2 ring-offset-2 ring-white' : ''
              }`}
              style={{
                top: badgeTop,
                left: badgeLeft,
                width: 20,
                height: 20,
                zIndex: isActive ? 30 : 20,
              }}
              title={a.comment}
            >
              {ordinal}
            </button>
          </div>
        )
      })}
    </div>
  )
}
