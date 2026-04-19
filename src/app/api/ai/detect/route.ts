import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a documentation quality reviewer for Cherry Studio enterprise docs.
Analyze the provided MDX documentation content and identify issues.

Categories to check:
- terminology: Inconsistent or incorrect terminology
- formatting: MDX/markdown formatting issues
- accuracy: Factually incorrect or outdated information
- translation: Translation gaps or inconsistencies (if locale context provided)
- structure: Poor document structure or flow
- links: Broken or suspicious links
- components: Incorrect usage of MDX components

Return a JSON array of issues found. Each issue must have:
- line: approximate line number in the source
- severity: "error" | "warning" | "info"
- category: one of the categories above
- description: clear description of the issue
- suggestion: how to fix it
- originalText: the problematic text (short excerpt)
- fixedText: the corrected text

Return ONLY the JSON array, no other text.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  const { content, filePath, locale } = await req.json()

  if (!content || !filePath) {
    return Response.json({ error: 'Missing content or filePath' }, { status: 400 })
  }

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `File: ${filePath}\nLocale: ${locale || 'unknown'}\n\n---\n\n${content}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const issues = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    return Response.json({
      issues: issues.map((issue: Record<string, unknown>, i: number) => ({
        id: `ai-${i}`,
        ...issue,
      })),
    })
  } catch {
    return Response.json({ issues: [], rawResponse: text })
  }
}
