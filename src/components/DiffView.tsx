'use client'

import { Check, X } from 'lucide-react'

interface DiffViewProps {
  original: string
  modified: string
  filePath: string
  onApprove: () => void
  onReject: () => void
}

export default function DiffView({
  original,
  modified,
  filePath,
  onApprove,
  onReject,
}: DiffViewProps) {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')

  // Simple line-by-line diff
  const maxLen = Math.max(originalLines.length, modifiedLines.length)
  const diffLines: { type: 'same' | 'removed' | 'added'; line: string; lineNum: number }[] = []

  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i]
    const modLine = modifiedLines[i]

    if (origLine === modLine) {
      diffLines.push({ type: 'same', line: origLine || '', lineNum: i + 1 })
    } else {
      if (origLine !== undefined) {
        diffLines.push({ type: 'removed', line: origLine, lineNum: i + 1 })
      }
      if (modLine !== undefined) {
        diffLines.push({ type: 'added', line: modLine, lineNum: i + 1 })
      }
    }
  }

  const hasChanges = diffLines.some((d) => d.type !== 'same')

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-muted border-b border-border flex items-center justify-between">
        <span className="text-sm font-mono text-gray-600">{filePath}</span>
        <div className="flex gap-2">
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
          >
            <X size={14} />
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={!hasChanges}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
          >
            <Check size={14} />
            Approve
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
        {diffLines.map((d, i) => (
          <div
            key={i}
            className={`px-4 py-0.5 flex ${
              d.type === 'removed'
                ? 'bg-red-50 text-red-800'
                : d.type === 'added'
                  ? 'bg-green-50 text-green-800'
                  : ''
            }`}
          >
            <span className="w-8 text-right text-gray-400 mr-3 select-none">
              {d.lineNum}
            </span>
            <span className="w-4 select-none text-gray-400">
              {d.type === 'removed' ? '-' : d.type === 'added' ? '+' : ' '}
            </span>
            <span className="whitespace-pre">{d.line}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
