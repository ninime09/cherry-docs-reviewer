import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getOctokit, commitChanges } from '@/lib/github'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { owner, repo, branch, changes, message } = await req.json()

  if (!owner || !repo || !branch || !changes?.length) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const octokit = await getOctokit(session.user.id)

  try {
    const sha = await commitChanges(octokit, owner, repo, branch, changes, message)
    return Response.json({ sha, message: 'Changes committed successfully' })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Failed to commit'
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
