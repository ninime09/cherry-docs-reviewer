'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X, Crop } from 'lucide-react'

type ImageSelection = {
  src: string
  alt?: string
  region: { x: number; y: number; w: number; h: number } | null
}

interface CommentPopupProps {
  /** Text selection — pass selectedText to render a text quote preview */
  selectedText?: string
  /** Image selection — pass imageSelection to render an image preview */
  imageSelection?: ImageSelection
  onSubmit: (comment: string) => void
  onCancel: () => void
}

export default function CommentPopup({
  selectedText,
  imageSelection,
  onSubmit,
  onCancel,
}: CommentPopupProps) {
  const [comment, setComment] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit() {
    if (!comment.trim()) return
    onSubmit(comment)
    setComment('')
  }

  const region = imageSelection?.region

  return (
    <div
      data-annotation-popup
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
    >
      <div className="bg-background border border-border rounded-xl shadow-lg w-[420px] max-w-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            {imageSelection && (
              <>
                {region ? <Crop size={14} /> : <span>🖼️</span>}
                <span>{region ? 'Annotate Region' : 'Annotate Image'}</span>
              </>
            )}
            {!imageSelection && <span>Add Annotation</span>}
          </h4>
          <button onClick={onCancel} className="text-gray-400 hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Preview area */}
        {imageSelection ? (
          <div className="mb-3 rounded-lg border border-border bg-muted/30 overflow-hidden">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSelection.src}
                alt={imageSelection.alt || ''}
                className="block w-full max-h-60 object-contain bg-background"
              />
              {region && (
                <div
                  className="absolute border-2 border-accent bg-accent/20 pointer-events-none"
                  style={{
                    left: `${region.x * 100}%`,
                    top: `${region.y * 100}%`,
                    width: `${region.w * 100}%`,
                    height: `${region.h * 100}%`,
                  }}
                />
              )}
            </div>
            {imageSelection.alt && (
              <div className="px-3 py-1.5 text-[11px] text-gray-500 border-t border-border truncate">
                alt: {imageSelection.alt}
              </div>
            )}
          </div>
        ) : (
          selectedText && (
            <div className="bg-yellow-50 px-3 py-2 rounded-lg mb-3 text-sm text-yellow-800 line-clamp-3 font-mono">
              &ldquo;{selectedText}&rdquo;
            </div>
          )
        )}

        {/* Comment input */}
        <textarea
          ref={inputRef}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            imageSelection
              ? region
                ? 'Comment on this region...'
                : 'Comment on this image...'
              : 'Your review comment...'
          }
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit()
            }
          }}
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-400">Cmd+Enter to submit</span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-500 hover:bg-muted rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!comment.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
            >
              <Send size={14} />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
