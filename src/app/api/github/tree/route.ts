import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getOctokit, fetchRepoTree } from '@/lib/github'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const owner = searchParams.get('owner')
  const repo = searchParams.get('repo')
  const ref = searchParams.get('ref')

  if (!owner || !repo || !ref) {
    return Response.json({ error: 'Missing owner, repo, or ref' }, { status: 400 })
  }

  try {
    const octokit = await getOctokit(session.user.id)
    const files = await fetchRepoTree(octokit, owner, repo, ref)
    return Response.json({ files })
  } catch (e) {
    const err = e as { message?: string }
    return Response.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
