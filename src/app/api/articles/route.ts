import { NextRequest } from 'next/server'
import { getApiAuthUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sanitizeArticleHtml } from '@/lib/sanitize-article'
import { notifyArticleCreated } from '@/lib/feishu-webhook'

// Slug-ify Chinese / mixed titles into a URL-safe-ish handle.
// We don't try to transliterate; we just keep alnums and replace the rest with "-".
// The final id stays the cuid, slug is just a nicer display key in the URL.
function slugify(input: string): string {
  const ascii = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '')
  return ascii.slice(0, 80) || `article-${Date.now()}`
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base
  let i = 1
  while (await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    i += 1
    candidate = `${base}-${i}`
  }
  return candidate
}

export async function POST(req: NextRequest) {
  const user = await getApiAuthUser(req)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { title, htmlSnapshot, digest, source, slug: requestedSlug } = body

  if (!title || !htmlSnapshot) {
    return Response.json({ error: 'Missing title or htmlSnapshot' }, { status: 400 })
  }

  const slug = await ensureUniqueSlug(requestedSlug ? slugify(requestedSlug) : slugify(title))

  const article = await prisma.article.create({
    data: {
      title,
      slug,
      digest: digest || null,
      htmlSnapshot: sanitizeArticleHtml(htmlSnapshot),
      source: source || null,
      createdById: user.id,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      digest: true,
      status: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  })

  notifyArticleCreated(article)

  return Response.json(article, { status: 201 })
}

// Team-wide visibility: every authenticated user sees every article.
// htmlSnapshot is intentionally excluded — listing thousands of base64-laden
// rows would balloon the response. Use GET /api/articles/:id for the full body.
export async function GET(req: NextRequest) {
  const user = await getApiAuthUser(req)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const articles = await prisma.article.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      digest: true,
      status: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { annotations: true } },
    },
  })

  return Response.json(
    articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      digest: a.digest,
      status: a.status,
      source: a.source,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      createdBy: a.createdBy,
      annotationCount: a._count.annotations,
    }))
  )
}
