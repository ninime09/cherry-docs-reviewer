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

// MDX 3 compiles lowercase JSX tags like <img /> as native HTML intrinsic
// elements and does NOT route them through the components map. This breaks
// our Img stub (and therefore image annotation). Convert self-closing <img>
// JSX with literal string src/alt into markdown `![alt](src)` so MDX sends
// it through _components.img.
//
// Only touches cases where we can safely extract src/alt as string literals.
// Imgs that use JSX expressions for src (like `<img src={foo} />`) fall
// through untouched.
function rewriteImgJsxToMarkdown(source: string): string {
  return source.replace(/<img\b([^>]*?)\/>/g, (match, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*"([^"]+)"|\bsrc\s*=\s*'([^']+)'/)
    const src = srcMatch?.[1] ?? srcMatch?.[2]
    if (!src) return match
    const altMatch = attrs.match(/\balt\s*=\s*"([^"]*)"|\balt\s*=\s*'([^']*)'/)
    const alt = altMatch?.[1] ?? altMatch?.[2] ?? ''
    return `![${alt}](${src})`
  })
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
    const cleaned = rewriteImgJsxToMarkdown(stripImportsAndExports(content))
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
