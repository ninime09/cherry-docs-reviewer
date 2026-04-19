'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X } from 'lucide-react'

interface CommentPopupProps {
  selectedText: string
  onSubmit: (comment: string) => void
  onCancel: () => void
}

export default function CommentPopup({ selectedText, onSubmit, onCancel }: CommentPopupProps) {
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

  return (
    <div
      data-annotation-popup
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
    >
      <div className="bg-background border border-border rounded-xl shadow-lg w-96 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Add Annotation</h4>
          <button onClick={onCancel} className="text-gray-400 hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Selected text preview */}
        <div className="bg-yellow-50 px-3 py-2 rounded-lg mb-3 text-sm text-yellow-800 line-clamp-3 font-mono">
          &ldquo;{selectedText}&rdquo;
        </div>

        {/* Comment input */}
        <textarea
          ref={inputRef}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Your review comment..."
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
