import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOctokit, parsePRUrl, fetchPRInfo } from '@/lib/github'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { prUrl } = await req.json()
  const parsed = parsePRUrl(prUrl)
  if (!parsed) {
    return Response.json({ error: 'Invalid PR URL' }, { status: 400 })
  }

  const octokit = await getOctokit(session.user.id)
  const prInfo = await fetchPRInfo(octokit, parsed.owner, parsed.repo, parsed.number)

  const reviewSession = await prisma.reviewSession.create({
    data: {
      prUrl,
      owner: parsed.owner,
      repo: parsed.repo,
      prNumber: parsed.number,
      branch: prInfo.branch,
      headSha: prInfo.headSha,
      title: prInfo.title,
      createdById: session.user.id,
    },
  })

  return Response.json(reviewSession)
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessions = await prisma.reviewSession.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { name: true, image: true } },
      _count: { select: { annotations: true } },
    },
  })

  return Response.json(
    sessions.map((s) => ({
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
      createdBy: s.createdBy,
      annotationCount: s._count.annotations,
    }))
  )
}
