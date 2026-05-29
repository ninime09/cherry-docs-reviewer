import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const token = await prisma.apiToken.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!token) return Response.json({ error: 'Not found' }, { status: 404 })
  if (token.userId !== session.user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.apiToken.delete({ where: { id } })
  return Response.json({ ok: true })
}
