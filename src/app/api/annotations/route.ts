import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  const filePath = req.nextUrl.searchParams.get('filePath')
  const since = req.nextUrl.searchParams.get('since') // ISO timestamp for polling

  if (!sessionId) {
    return Response.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  const where: Record<string, unknown> = { sessionId }
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
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    sessionId, type, filePath, locale,
    selectedText, globalOffset, contextBefore, contextAfter, sourceLine,
    areaX, areaY, areaWidth, areaHeight,
    comment,
  } = body

  if (!sessionId || !type || !filePath || !comment) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const [annotation] = await prisma.$transaction([
    prisma.annotation.create({
      data: {
        sessionId,
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
        reviewerId: session.user.id,
      },
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.reviewSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    }),
  ])

  return Response.json(annotation, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, status, comment, reply } = await req.json()

  if (!id) {
    return Response.json({ error: 'Missing annotation id' }, { status: 400 })
  }

  // Look up the annotation's sessionId so we can touch updatedAt
  const existing = await prisma.annotation.findUnique({
    where: { id },
    select: { sessionId: true },
  })

  async function touchSession() {
    if (!existing) return
    await prisma.reviewSession.update({
      where: { id: existing.sessionId },
      data: { updatedAt: new Date() },
    })
  }

  // Add a reply
  if (reply) {
    const newReply = await prisma.reply.create({
      data: {
        annotationId: id,
        authorId: session.user.id,
        comment: reply,
      },
      include: { author: { select: { id: true, name: true, image: true } } },
    })
    await touchSession()
    return Response.json(newReply)
  }

  // Update status or comment
  const updateData: Record<string, unknown> = {}
  if (status) updateData.status = status
  if (comment !== undefined) updateData.comment = comment

  const updated = await prisma.annotation.update({
    where: { id },
    data: updateData,
  })
  await touchSession()

  return Response.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json()
  const existing = await prisma.annotation.findUnique({
    where: { id },
    select: { sessionId: true },
  })
  await prisma.annotation.delete({ where: { id } })
  if (existing) {
    await prisma.reviewSession.update({
      where: { id: existing.sessionId },
      data: { updatedAt: new Date() },
    })
  }
  return Response.json({ ok: true })
}
