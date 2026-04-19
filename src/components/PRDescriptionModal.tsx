'use client'

import { useState } from 'react'
import { X, Copy, Check, Eye, Code } from 'lucide-react'

interface PRDescriptionModalProps {
  markdown: string
  onClose: () => void
}

export default function PRDescriptionModal({ markdown, onClose }: PRDescriptionModalProps) {
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'rendered' | 'raw'>('rendered')

  function copyToClipboard() {
    navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">PR Description</h3>
            <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setTab('rendered')}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                  tab === 'rendered' ? 'bg-background shadow-sm' : 'text-gray-500 hover:text-foreground'
                }`}
              >
                <Eye size={12} />
                Preview
              </button>
              <button
                onClick={() => setTab('raw')}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                  tab === 'raw' ? 'bg-background shadow-sm' : 'text-gray-500 hover:text-foreground'
                }`}
              >
                <Code size={12} />
                Raw
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:opacity-90 transition"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-foreground">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {tab === 'rendered' ? (
            <div
              className="mdx-preview text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
            />
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-4 rounded-lg">
              {markdown}
            </pre>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2 border-t border-border text-xs text-gray-400 shrink-0">
          💡 Copy this and paste into your upstream PR description on GitHub
        </div>
      </div>
    </div>
  )
}

// Minimal markdown renderer for preview
function renderMarkdown(md: string): string {
  return md
    // Headers (do h3 before h2 before h1 to avoid conflicts)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Tables (simple)
    .replace(/^\|(.+)\|\s*$/gm, (m) => {
      if (m.includes('---')) return '' // skip separator row
      const cells = m.split('|').filter((c) => c.trim() !== '')
      return '<tr>' + cells.map((c) => `<td>${c.trim()}</td>`).join('') + '</tr>'
    })
    .replace(/((?:<tr>.*<\/tr>\s*)+)/g, '<table>$1</table>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-accent underline">$1</a>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Numbered list items
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // Paragraphs (double newline → <br><br>)
    .replace(/\n\n/g, '<br /><br />')
}
