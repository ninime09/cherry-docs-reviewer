import type { AnnotationData } from '@/types'

/**
 * Generate a concise hand-off prompt for Claude Code / Codex.
 * Assumes the agent has filesystem access to the docs repo (via Conductor or similar),
 * so we don't include file content — just pointers to where each change should happen.
 * Aggregates all still-open annotations across all files.
 */
export function generatePrompt(annotations: AnnotationData[]): string {
  const open = annotations.filter((a) => a.status === 'open')

  if (open.length === 0) {
    return '# No pending annotations\n\n所有批注都已标记为 done / resolved / wontfix。'
  }

  // Group by file, preserving order
  const byFile = new Map<string, AnnotationData[]>()
  for (const a of open) {
    const list = byFile.get(a.filePath) ?? []
    list.push(a)
    byFile.set(a.filePath, list)
  }

  const lines: string[] = []
  lines.push('# Task: Apply documentation review fixes')
  lines.push('')
  lines.push(
    `${open.length} 条待处理批注，分布在 ${byFile.size} 个文件中。文件已在当前 workspace — 直接读取并修改即可。`
  )
  lines.push('')

  for (const [filePath, items] of byFile) {
    lines.push(`## ${filePath}`)
    items.forEach((a, i) => {
      const loc = a.sourceLine ? `L${a.sourceLine}` : ''
      const quote = a.selectedText ? `\`${truncate(a.selectedText, 60)}\`` : ''
      const locator = [loc, quote].filter(Boolean).join(' ')
      const prefix = locator ? `[${locator}] ` : ''
      const comment = a.comment.replace(/\s+/g, ' ').trim()
      lines.push(`${i + 1}. ${prefix}${comment}`)
    })
    lines.push('')
  }

  lines.push('## Requirements')
  lines.push('- 保留 MDX 组件、frontmatter、原有格式')
  lines.push('- 改完简要说明每处变动')

  return lines.join('\n')
}

function truncate(str: string, n: number): string {
  const s = str.replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}
