'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Check,
  CheckCheck,
  X,
  MessageCircle,
  Send,
  Clipboard,
  Sparkles,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react'
import type { AnnotationData } from '@/types'

interface AnnotationPanelProps {
  annotations: AnnotationData[]
  /** Path of the currently open file — used as default scope when set */
  currentFilePath?: string | null
  activeId?: string
  /** Called when the user clicks an annotation. If the annotation lives in a
   *  different file than currentFilePath, the handler should switch to it. */
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onReply: (id: string, comment: string) => void
  onDelete: (id: string) => void
  currentUserId?: string
}

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-yellow-100 text-yellow-800', icon: MessageCircle },
  done: { label: 'Done', color: 'bg-green-100 text-green-800', icon: Check },
  resolved: { label: 'Resolved', color: 'bg-gray-100 text-gray-600', icon: CheckCheck },
  wontfix: { label: "Won't Fix", color: 'bg-red-100 text-red-700', icon: X },
}

export default function AnnotationPanel({
  annotations,
  currentFilePath,
  activeId,
  onSelect,
  onStatusChange,
  onReply,
  onDelete,
  currentUserId,
}: AnnotationPanelProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  // Scope: whether to show annotations on the current file only or across all
  // files in this session. Default to 'all' when no file is open.
  const [scope, setScope] = useState<'current' | 'all'>(
    currentFilePath ? 'current' : 'all'
  )

  // When the user opens a file for the first time, default to 'current' scope.
  // We track the previous value so we don't override an explicit user choice.
  const prevFileRef = useRef<string | null | undefined>(currentFilePath)
  useEffect(() => {
    if (currentFilePath && !prevFileRef.current) {
      setScope('current')
    }
    prevFileRef.current = currentFilePath
  }, [currentFilePath])

  // Scope filter: only annotations on the current file, or all
  const inScope =
    scope === 'current' && currentFilePath
      ? annotations.filter((a) => a.filePath === currentFilePath)
      : annotations

  // Status filter on top of scope
  const filtered =
    filter === 'all' ? inScope : inScope.filter((a) => a.status === filter)

  // Group by status
  const groups = {
    open: filtered.filter((a) => a.status === 'open'),
    done: filtered.filter((a) => a.status === 'done'),
    resolved: filtered.filter((a) => a.status === 'resolved'),
    wontfix: filtered.filter((a) => a.status === 'wontfix'),
  }

  const counts = {
    all: inScope.length,
    open: inScope.filter((a) => a.status === 'open').length,
    done: inScope.filter((a) => a.status === 'done').length,
    resolved: inScope.filter((a) => a.status === 'resolved').length,
  }

  function handleReply(annotationId: string) {
    if (!replyText.trim()) return
    onReply(annotationId, replyText)
    setReplyText('')
    setReplyingTo(null)
  }

  function toggleGroup(status: string) {
    const next = new Set(collapsedGroups)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setCollapsedGroups(next)
  }

  return (
    <div className="w-80 border-l border-border flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Annotations</h3>
          {/* Scope toggle — only meaningful when a file is selected */}
          {currentFilePath && (
            <div className="flex bg-muted rounded p-0.5 gap-0.5 text-[10px]">
              <button
                onClick={() => setScope('current')}
                className={`px-2 py-0.5 rounded transition ${
                  scope === 'current'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-gray-500 hover:text-foreground'
                }`}
                title="Show annotations on the current file"
              >
                This file
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-2 py-0.5 rounded transition ${
                  scope === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-gray-500 hover:text-foreground'
                }`}
                title="Show all annotations across every file in this session"
              >
                All files ({annotations.length})
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {(['all', 'open', 'done', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                filter === f
                  ? 'bg-accent text-white'
                  : 'bg-muted text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_CONFIG[f].label} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Annotation list */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            No annotations yet. Select text in the preview to add one.
          </div>
        ) : (
          Object.entries(groups).map(([status, items]) => {
            if (items.length === 0) return null
            const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
            const isCollapsed = collapsedGroups.has(status)
            return (
              <div key={status}>
                <button
                  onClick={() => toggleGroup(status)}
                  className="w-full px-4 py-2 flex items-center gap-2 bg-muted/50 text-xs font-medium text-gray-500 hover:bg-muted"
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  {config.label} ({items.length})
                </button>
                {!isCollapsed &&
                  items.map((annotation, idx) => (
                    <div
                      key={annotation.id}
                      onClick={() => onSelect(annotation.id)}
                      className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/50 transition ${
                        activeId === annotation.id ? 'bg-accent-light/50 border-l-2 border-l-accent' : ''
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                            {annotations.indexOf(annotation) + 1}
                          </span>
                          <img
                            src={annotation.reviewer.image || ''}
                            alt=""
                            className="w-4 h-4 rounded-full"
                          />
                          <span className="text-xs text-gray-500">
                            {annotation.reviewer.name}
                          </span>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}
                        >
                          {config.label}
                        </span>
                      </div>

                      {/* Preview: image thumbnail for image/area, text quote otherwise */}
                      {(annotation.type === 'image' || annotation.type === 'area') &&
                      annotation.contextBefore ? (
                        <div className="mb-1.5 rounded border border-border overflow-hidden bg-muted/30">
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={annotation.contextBefore}
                              alt={annotation.selectedText || ''}
                              className="block w-full max-h-32 object-contain bg-background"
                            />
                            {annotation.type === 'area' &&
                              annotation.areaX != null &&
                              annotation.areaY != null &&
                              annotation.areaWidth != null &&
                              annotation.areaHeight != null && (
                                <div
                                  className="absolute border-2 border-accent bg-accent/20 pointer-events-none"
                                  style={{
                                    left: `${annotation.areaX * 100}%`,
                                    top: `${annotation.areaY * 100}%`,
                                    width: `${annotation.areaWidth * 100}%`,
                                    height: `${annotation.areaHeight * 100}%`,
                                  }}
                                />
                              )}
                          </div>
                          {annotation.selectedText && (
                            <div className="px-2 py-1 text-[10px] text-gray-500 border-t border-border truncate">
                              {annotation.type === 'area' ? '🔲 region · ' : '🖼 image · '}
                              {annotation.selectedText}
                            </div>
                          )}
                        </div>
                      ) : annotation.selectedText ? (
                        <div className="text-xs bg-yellow-50 px-2 py-1 rounded mb-1.5 text-yellow-800 line-clamp-2 font-mono">
                          &ldquo;{annotation.selectedText}&rdquo;
                        </div>
                      ) : null}

                      {/* Comment */}
                      <p className="text-sm">{annotation.comment}</p>

                      {/* File path — more prominent in "all files" mode,
                          since the same list may span many files */}
                      <p
                        className={`text-[10px] mt-1 font-mono truncate flex items-center gap-1 ${
                          scope === 'all' && annotation.filePath !== currentFilePath
                            ? 'text-accent'
                            : 'text-gray-400'
                        }`}
                      >
                        {scope === 'all' && <FileText size={10} className="shrink-0" />}
                        {annotation.filePath}
                        {scope === 'all' && annotation.filePath !== currentFilePath && (
                          <span className="ml-auto text-[9px] opacity-60">点击跳转</span>
                        )}
                      </p>

                      {/* Replies */}
                      {annotation.replies.length > 0 && (
                        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-gray-200">
                          {annotation.replies.map((r) => (
                            <div key={r.id} className="text-xs">
                              <span className="font-medium">{r.author.name}: </span>
                              <span className="text-gray-600">{r.comment}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 mt-2">
                        {annotation.status === 'open' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onStatusChange(annotation.id, 'done')
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-green-50 text-green-700 hover:bg-green-100 transition"
                            title="Mark as done"
                          >
                            <Check size={12} />
                            Done
                          </button>
                        )}
                        {annotation.status === 'done' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onStatusChange(annotation.id, 'resolved')
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                            title="Confirm resolved"
                          >
                            <CheckCheck size={12} />
                            Resolve
                          </button>
                        )}
                        {(annotation.status === 'open' || annotation.status === 'done') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onStatusChange(annotation.id, 'wontfix')
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-100 transition"
                            title="Won't fix"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setReplyingTo(replyingTo === annotation.id ? null : annotation.id)
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-100 transition ml-auto"
                        >
                          <MessageCircle size={12} />
                        </button>
                        {annotation.reviewer.id === currentUserId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDelete(annotation.id)
                            }}
                            className="px-2 py-1 rounded text-[11px] text-red-400 hover:bg-red-50 transition"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Reply input */}
                      {replyingTo === annotation.id && (
                        <div className="mt-2 flex gap-1">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Reply..."
                            className="flex-1 px-2 py-1 border border-border rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-accent/50"
                            onKeyDown={(e) =>
                              e.key === 'Enter' && handleReply(annotation.id)
                            }
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReply(annotation.id)
                            }}
                            className="p-1 text-accent hover:bg-accent-light rounded transition"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
