import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a documentation editor for Cherry Studio enterprise docs.
Given an MDX file and a list of issues/annotations to fix, produce the corrected MDX content.

Rules:
- Only fix the issues listed. Do not make other changes.
- Preserve all MDX components, frontmatter, and formatting.
- Maintain the original language/locale of the content.
- Return ONLY the corrected MDX content, no explanations.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  const { content, filePath, issues, annotations } = await req.json()

  if (!content || !filePath) {
    return Response.json({ error: 'Missing content or filePath' }, { status: 400 })
  }

  // Build fix instructions from either AI issues or human annotations
  let instructions = ''
  if (issues?.length) {
    instructions = issues
      .map(
        (issue: { line: number; description: string; suggestion: string }, i: number) =>
          `${i + 1}. [Line ${issue.line}] ${issue.description} → ${issue.suggestion}`
      )
      .join('\n')
  } else if (annotations?.length) {
    instructions = annotations
      .map(
        (a: { sourceLine?: number; selectedText?: string; comment: string }, i: number) =>
          `${i + 1}. [${a.sourceLine ? `Line ${a.sourceLine}` : `"${a.selectedText}"`}] ${a.comment}`
      )
      .join('\n')
  }

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `File: ${filePath}\n\n## Issues to fix:\n${instructions}\n\n## Current content:\n\`\`\`mdx\n${content}\n\`\`\`\n\nReturn the corrected MDX content:`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip markdown code block wrapper if present
  const mdxContent = text.replace(/^```mdx?\n?/, '').replace(/\n?```$/, '')

  return Response.json({ fixedContent: mdxContent, originalContent: content })
}
