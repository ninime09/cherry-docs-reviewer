import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Any authenticated user can fetch any session by id. Discovery is private
// (the /api/sessions list endpoint shows all, but reviewers typically land
// here via a shared link).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth0 = await auth()
  if (!auth0?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const s = await prisma.reviewSession.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { annotations: true } },
    },
  })

  if (!s) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({
    id: s.id,
    prUrl: s.prUrl,
    owner: s.owner,
    repo: s.repo,
    prNumber: s.prNumber,
    branch: s.branch,
    headSha: s.headSha,
    title: s.title,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    createdBy: s.createdBy,
    annotationCount: s._count.annotations,
  })
}
