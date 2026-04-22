import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOctokit, fetchPRInfo } from '@/lib/github'

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

  return Response.json(serializeSession(s))
}

// Refresh a session: re-fetch the PR from GitHub and update headSha, branch,
// title to the latest. Used when the PR has received new commits and the
// reviewer wants to see the updated code without creating a new session.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth0 = await auth()
  if (!auth0?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.reviewSession.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const octokit = await getOctokit(auth0.user.id)
    const prInfo = await fetchPRInfo(
      octokit,
      existing.owner,
      existing.repo,
      existing.prNumber
    )

    const previousHeadSha = existing.headSha
    const headShaChanged = previousHeadSha !== prInfo.headSha

    const updated = await prisma.reviewSession.update({
      where: { id },
      data: {
        headSha: prInfo.headSha,
        branch: prInfo.branch,
        title: prInfo.title,
      },
      include: {
        createdBy: { select: { id: true, name: true, image: true } },
        _count: { select: { annotations: true } },
      },
    })

    return Response.json({
      ...serializeSession(updated),
      headShaChanged,
      previousHeadSha,
    })
  } catch (e) {
    const err = e as { message?: string; status?: number }
    return Response.json(
      { error: err.message || 'Failed to refresh from GitHub' },
      { status: err.status || 500 }
    )
  }
}

type SessionWithIncludes = Awaited<ReturnType<typeof prisma.reviewSession.findUnique>> & {
  createdBy: { id: string; name: string | null; image: string | null }
  _count: { annotations: number }
}

function serializeSession(s: SessionWithIncludes) {
  return {
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
  }
}
