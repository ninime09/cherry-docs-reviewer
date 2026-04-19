import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { serialize } from 'next-mdx-remote/serialize'
import remarkGfm from 'remark-gfm'
import { rehypeRewriteAssets } from '@/lib/rehype-rewrite-assets'

// Strip MDX imports/exports before compilation.
// The components they reference will be provided as stubs at render time.
function stripImportsAndExports(source: string): string {
  source = source.replace(/^import\s[\s\S]+?from\s+['"][^'"]+['"];?\s*$/gm, '')
  source = source.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
  source = source.replace(/^export\s+.*$/gm, '')
  return source
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content, owner, repo, gitRef } = await req.json()
  if (typeof content !== 'string') {
    return Response.json({ error: 'Missing content' }, { status: 400 })
  }

  try {
    const cleaned = stripImportsAndExports(content)
    const rehypePlugins =
      owner && repo && gitRef
        ? [[rehypeRewriteAssets, { owner, repo, gitRef }] as const]
        : []

    const compiled = await serialize(cleaned, {
      parseFrontmatter: true,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins: rehypePlugins as any,
        development: false,
      },
    })
    return Response.json(compiled)
  } catch (e) {
    const err = e as { message?: string }
    return Response.json(
      { error: `MDX compilation failed: ${err.message || 'unknown error'}` },
      { status: 500 }
    )
  }
}
