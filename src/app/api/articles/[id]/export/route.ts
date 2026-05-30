import { NextRequest } from 'next/server'
import { getApiAuthUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { wrapArticleInPublisherShell } from '@/lib/publisher-shell'

// Build a slug-safe ASCII fallback for the Content-Disposition filename.
// RFC 5987 lets us send the original UTF-8 in `filename*`, but most browsers
// also need an ASCII `filename=` to avoid edge-case parsing.
function asciiSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '')
    .slice(0, 80) || 'article'
}

async function findByIdOrSlug(idOrSlug: string) {
  const byId = await prisma.article.findUnique({
    where: { id: idOrSlug },
    select: { id: true, slug: true, title: true, htmlSnapshot: true },
  })
  if (byId) return byId
  return prisma.article.findUnique({
    where: { slug: idOrSlug },
    select: { id: true, slug: true, title: true, htmlSnapshot: true },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiAuthUser(req)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const article = await findByIdOrSlug(id)
  if (!article) return Response.json({ error: 'Not found' }, { status: 404 })

  const wrapped = wrapArticleInPublisherShell({
    title: article.title,
    contentHtml: article.htmlSnapshot,
  })

  const asciiName = `cherry-wechat-${asciiSlug(article.slug)}.html`
  const utf8Name = encodeURIComponent(`cherry-wechat-${article.slug}.html`)

  return new Response(wrapped, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Both `filename` (ASCII) and `filename*` (UTF-8) — broadly compatible.
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      'Cache-Control': 'no-store',
    },
  })
}
