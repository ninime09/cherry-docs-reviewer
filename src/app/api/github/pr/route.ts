import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getOctokit, fetchPRFiles, fetchFileContent } from '@/lib/github'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const owner = searchParams.get('owner')
  const repo = searchParams.get('repo')
  const number = searchParams.get('number')
  const filePath = searchParams.get('file')
  const branch = searchParams.get('branch')

  if (!owner || !repo || !number) {
    return Response.json({ error: 'Missing owner, repo, or number' }, { status: 400 })
  }

  const octokit = await getOctokit(session.user.id)

  try {
    // If a specific file is requested, return its content
    if (filePath && branch) {
      const content = await fetchFileContent(octokit, owner, repo, filePath, branch)
      return Response.json({ content, path: filePath })
    }

    // Otherwise return the list of changed files
    const files = await fetchPRFiles(octokit, owner, repo, parseInt(number, 10))
    return Response.json({ files })
  } catch (e) {
    const err = e as { status?: number; message?: string }
    return Response.json(
      { error: err.message || 'Failed to fetch from GitHub', status: err.status },
      { status: err.status || 500 }
    )
  }
}
