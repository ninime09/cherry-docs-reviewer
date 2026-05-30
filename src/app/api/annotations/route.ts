import { NextRequest } from 'next/server'
import { getApiAuthUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { notifyAnnotationCreated, notifyAnnotationReopened } from '@/lib/feishu-webhook'

// Touch the parent (ReviewSession or Article) so polling clients see "something changed".
async function touchParent(opts: { sessionId?: string | null; articleId?: string | null }) {
  if (opts.sessionId) {
    await prisma.reviewSession.update({
      where: { id: opts.sessionId },
      data: { updatedAt: new Date() },
    })
  } else if (opts.articleId) {
    await prisma.article.update({
      where: { id: opts.articleId },
      data: { updatedAt: new Date() },
    })
  }
}

export async function GET(req: NextRequest) {
  const user = await getApiAuthUser(req)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  const articleId = req.nextUrl.searchParams.get('articleId')
  const filePath = req.nextUrl.searchParams.get('filePath')
  const since = req.nextUrl.searchParams.get('since') // ISO timestamp for polling

  if (!sessionId && !articleId) {
    return Response.json({ error: 'Missing sessionId or articleId' }, { status: 400 })
  }

  const where: Record<string, unknown> = {}
  if (sessionId) where.sessionId = sessionId
  if (articleId) where.articleId = articleId
  if (filePath) where.filePath = filePath
  if (since) where.updatedAt = { gt: new Date(since) }

  const annotations = await prisma.annotation.findMany({
    where,
    include: {
      reviewer: { select: { id: true, name: true, image: true } },
      replies: {
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json(
    annotations.map((a) => ({
      id: a.id,
      sessionId: a.sessionId,
      articleId: a.articleId,
      type: a.type,
      filePath: a.filePath,
      locale: a.locale,
      selectedText: a.selectedText,
      globalOffset: a.globalOffset,
      contextBefore: a.contextBefore,
      contextAfter: a.contextAfter,
      sourceLine: a.sourceLine,
      areaX: a.areaX,
      areaY: a.areaY,
      areaWidth: a.areaWidth,
      areaHeight: a.areaHeight,
      comment: a.comment,
      reviewer: a.reviewer,
      status: a.status,
      replies: a.replies.map((r) => ({
        id: r.id,
        author: r.author,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      })),
      createdAt: a.createdAt.toISOString(),
    }))
  )
}

export async function POST(req: NextRequest) {
  const user = await getApiAuthUser(req)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    sessionId, articleId, type, filePath, locale,
    selectedText, globalOffset, contextBefore, contextAfter, sourceLine,
    areaX, areaY, areaWidth, areaHeight,
    comment,
  } = body

  if ((!sessionId && !articleId) || (sessionId && articleId)) {
    return Response.json({ error: 'Provide exactly one of sessionId or articleId' }, { status: 400 })
  }
  if (!type || !filePath || !comment) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const annotation = await prisma.annotation.create({
    data: {
      sessionId: sessionId || null,
      articleId: articleId || null,
      type,
      filePath,
      locale: locale || null,
      selectedText: selectedText || null,
      globalOffset: globalOffset ?? null,
      contextBefore: contextBefore || null,
      contextAfter: contextAfter || null,
      sourceLine: sourceLine ?? null,
      areaX: areaX ?? null,
      areaY: areaY ?? null,
      areaWidth: areaWidth ?? null,
      areaHeight: areaHeight ?? null,
      comment,
      reviewerId: user.id,
    },
    include: {
      reviewer: { select: { id: true, name: true, image: true } },
    },
  })

  await touchParent({ sessionId, articleId })

  // Notify the team about article annotations (PR review session annotations
  // don't go through Feishu — those have their own GitHub review loop).
  if (articleId) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { slug: true, title: true },
    })
    if (article) {
      notifyAnnotationCreated({
        article,
        reviewer: annotation.reviewer,
        selectedText: annotation.selectedText,
        comment: annotation.comment,
      })
    }
  }

  return Response.json(annotation, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await getApiAuthUser(req)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, status, comment, reply } = await req.json()

  if (!id) {
    return Response.json({ error: 'Missing annotation id' }, { status: 400 })
  }

  const existing = await prisma.annotation.findUnique({
    where: { id },
    select: { sessionId: true, articleId: true, status: true },
  })

  // Add a reply
  if (reply) {
    const newReply = await prisma.reply.create({
      data: {
        annotationId: id,
        authorId: user.id,
        comment: reply,
      },
      include: { author: { select: { id: true, name: true, image: true } } },
    })
    if (existing) await touchParent(existing)
    return Response.json(newReply)
  }

  // Update status or comment
  const updateData: Record<string, unknown> = {}
  if (status) updateData.status = status
  if (comment !== undefined) updateData.comment = comment

  const updated = await prisma.annotation.update({
    where: { id },
    data: updateData,
    include: { reviewer: { select: { id: true, name: true, image: true } } },
  })
  if (existing) await touchParent(existing)

  // Re-open & Edit: status went from resolved/done/wontfix → open AND comment changed.
  // That's the signal a human reviewer wasn't satisfied with the Agent fix and is
  // asking for a re-do — tell the team.
  const isReopen =
    existing &&
    existing.articleId &&
    existing.status !== 'open' &&
    status === 'open' &&
    comment !== undefined
  if (isReopen) {
    const article = await prisma.article.findUnique({
      where: { id: existing.articleId! },
      select: { slug: true, title: true },
    })
    if (article) {
      notifyAnnotationReopened({
        article,
        reviewer: updated.reviewer,
        comment: updated.comment,
      })
    }
  }

  return Response.json(updated)
}

export async function DELETE(req: NextRequest) {
  const user = await getApiAuthUser(req)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json()
  const existing = await prisma.annotation.findUnique({
    where: { id },
    select: { sessionId: true, articleId: true },
  })
  await prisma.annotation.delete({ where: { id } })
  if (existing) await touchParent(existing)
  return Response.json({ ok: true })
}
