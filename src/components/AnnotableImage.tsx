'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { MessageCircle, Crop } from 'lucide-react'

export interface ImageAnnotationSelection {
  src: string
  alt?: string
  // Region as normalized coordinates (0-1 relative to image). null = whole image.
  region: { x: number; y: number; w: number; h: number } | null
}

type Handler = (sel: ImageAnnotationSelection) => void

const ImageAnnotationContext = createContext<Handler | null>(null)

export function ImageAnnotationProvider({
  onImageAnnotate,
  children,
}: {
  onImageAnnotate: Handler
  children: React.ReactNode
}) {
  return (
    <ImageAnnotationContext.Provider value={onImageAnnotate}>
      {children}
    </ImageAnnotationContext.Provider>
  )
}

interface AnnotableImageProps {
  src: string
  alt?: string
  rawProps?: React.ImgHTMLAttributes<HTMLImageElement>
  className?: string
}

export default function AnnotableImage({ src, alt, rawProps, className }: AnnotableImageProps) {
  const onImageAnnotate = useContext(ImageAnnotationContext)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const [mode, setMode] = useState<'idle' | 'drawing'>('idle')
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null)

  function annotateWholeImage() {
    onImageAnnotate?.({ src, alt, region: null })
  }

  function enterDrawMode() {
    setMode('drawing')
    setDrawStart(null)
    setDrawEnd(null)
  }

  function cancelDraw() {
    setMode('idle')
    setDrawStart(null)
    setDrawEnd(null)
  }

  // ESC exits drawing mode
  useEffect(() => {
    if (mode !== 'drawing') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelDraw()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  function normPoint(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    return { x, y }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== 'drawing') return
    e.preventDefault()
    e.stopPropagation()
    setDrawStart(normPoint(e))
    setDrawEnd(normPoint(e))
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== 'drawing' || !drawStart) return
    setDrawEnd(normPoint(e))
  }

  function handleMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== 'drawing' || !drawStart) return
    e.preventDefault()
    e.stopPropagation()
    const end = normPoint(e)
    const x = Math.min(drawStart.x, end.x)
    const y = Math.min(drawStart.y, end.y)
    const w = Math.abs(end.x - drawStart.x)
    const h = Math.abs(end.y - drawStart.y)

    // Ignore tiny accidental drags
    if (w < 0.01 || h < 0.01) {
      cancelDraw()
      return
    }

    onImageAnnotate?.({ src, alt, region: { x, y, w, h } })
    cancelDraw()
  }

  const rect =
    drawStart && drawEnd
      ? {
          x: Math.min(drawStart.x, drawEnd.x),
          y: Math.min(drawStart.y, drawEnd.y),
          w: Math.abs(drawEnd.x - drawStart.x),
          h: Math.abs(drawEnd.y - drawStart.y),
        }
      : null

  // If no annotation handler available (e.g., not in annotate mode), just render
  // the plain image without any hover UI.
  if (!onImageAnnotate) {
    return (
      // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
      <img
        {...rawProps}
        src={src}
        alt={alt}
        className={className || 'my-4 max-w-full rounded-lg border border-border'}
      />
    )
  }

  return (
    <span ref={wrapperRef} className="relative inline-block group max-w-full">
      {/* eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element */}
      <img
        {...rawProps}
        src={src}
        alt={alt}
        className={className || 'my-4 max-w-full rounded-lg border border-border'}
        draggable={false}
      />

      {/* Hover toolbar */}
      {mode === 'idle' && (
        <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1 z-10">
          <button
            type="button"
            onClick={annotateWholeImage}
            className="flex items-center gap-1 px-2 py-1 bg-background/90 backdrop-blur border border-border rounded-md text-xs font-medium shadow hover:bg-accent hover:text-white transition"
            title="Annotate this whole image"
          >
            <MessageCircle size={12} />
            整图批注
          </button>
          <button
            type="button"
            onClick={enterDrawMode}
            className="flex items-center gap-1 px-2 py-1 bg-background/90 backdrop-blur border border-border rounded-md text-xs font-medium shadow hover:bg-accent hover:text-white transition"
            title="Drag a rectangle on the image to annotate a region"
          >
            <Crop size={12} />
            框选区域
          </button>
        </span>
      )}

      {/* Drawing mode overlay */}
      {mode === 'drawing' && (
        <span
          className="absolute inset-0 cursor-crosshair bg-black/20 rounded-lg select-none z-10"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            // Abandon drawing if mouse leaves the image area
            if (drawStart) cancelDraw()
          }}
        >
          {rect && rect.w > 0 && rect.h > 0 && (
            <span
              className="absolute border-2 border-accent bg-accent/20 pointer-events-none"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
              }}
            />
          )}
          <span className="absolute top-2 left-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
            拖拽画矩形 · Esc 取消
          </span>
        </span>
      )}
    </span>
  )
}
