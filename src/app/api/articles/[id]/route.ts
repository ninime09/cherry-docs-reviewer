import { NextRequest } from 'next/server'
import { getApiAuthUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sanitizeArticleHtml } from '@/lib/sanitize-article'

// Resolve either a cuid (`id`) or a slug. Slugs may contain CJK characters,
// so we can't rely on a charset test — try id first, fall back to slug.
async function findByIdOrSlug(idOrSlug: string) {
  const byId = await prisma.article.findUnique({
    where: { id: idOrSlug },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { annotations: true } },
    },
  })
  if (byId) return byId
  return prisma.article.findUnique({
    where: { slug: idOrSlug },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { annotations: true } },
    },
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

  return Response.json({
    id: article.id,
    slug: article.slug,
    title: article.title,
    digest: article.digest,
    htmlSnapshot: article.htmlSnapshot,
    status: article.status,
    source: article.source,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    createdBy: article.createdBy,
    annotationCount: article._count.annotations,
  })
}

export async function PATCH(
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

  const { title, digest, status, htmlSnapshot } = await req.json()

  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = title
  if (digest !== undefined) updateData.digest = digest
  if (status !== undefined) updateData.status = status
  if (htmlSnapshot !== undefined) updateData.htmlSnapshot = sanitizeArticleHtml(htmlSnapshot)

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: updateData,
    select: {
      id: true,
      slug: true,
      title: true,
      digest: true,
      status: true,
      updatedAt: true,
    },
  })

  return Response.json(updated)
}

export async function DELETE(
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

  // Cascade removes annotations + replies (via FK ON DELETE CASCADE).
  await prisma.article.delete({ where: { id: article.id } })

  return Response.json({ ok: true })
}
