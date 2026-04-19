import { Octokit } from '@octokit/rest'
import { prisma } from './prisma'

export async function getOctokit(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'github' },
  })
  if (!account?.access_token) {
    throw new Error('GitHub access token not found')
  }
  return new Octokit({ auth: account.access_token })
}

export function parsePRUrl(url: string): { owner: string; repo: string; number: number } | null {
  // Match: https://github.com/owner/repo/pull/123
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

export async function fetchPRInfo(octokit: Octokit, owner: string, repo: string, number: number) {
  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: number })
  return {
    owner,
    repo,
    number,
    title: pr.title,
    branch: pr.head.ref,
    headSha: pr.head.sha,
    baseBranch: pr.base.ref,
    state: pr.state,
    merged: pr.merged,
    user: { login: pr.user?.login ?? '', avatarUrl: pr.user?.avatar_url ?? '' },
  }
}

export async function fetchPRFiles(octokit: Octokit, owner: string, repo: string, number: number) {
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: number,
    per_page: 100,
  })
  return files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }))
}

export async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
) {
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref })
  if ('content' in data && data.type === 'file') {
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }
  throw new Error(`Not a file: ${path}`)
}

export interface PreviewInfo {
  url: string | null
  state: 'pending' | 'in_progress' | 'success' | 'failure' | 'error' | 'none'
  environment: string | null
  createdAt: string | null
}

/**
 * Fetch the latest Vercel (or any provider's) preview deployment URL for a branch/SHA.
 * Uses GitHub's Deployments API — every deployment created by Vercel/Netlify/etc.
 * is recorded here with its preview URL.
 */
export async function getPreviewDeployment(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<PreviewInfo> {
  try {
    const { data: deployments } = await octokit.repos.listDeployments({
      owner,
      repo,
      ref,
      per_page: 10,
    })

    if (deployments.length === 0) {
      return { url: null, state: 'none', environment: null, createdAt: null }
    }

    // Iterate through deployments (newest first) to find one with a preview URL
    for (const deployment of deployments) {
      const { data: statuses } = await octokit.repos.listDeploymentStatuses({
        owner,
        repo,
        deployment_id: deployment.id,
        per_page: 10,
      })

      // Find the most recent successful status with a preview URL
      const successStatus = statuses.find(
        (s) => s.state === 'success' && (s.environment_url || s.target_url)
      )

      if (successStatus) {
        return {
          url: successStatus.environment_url || successStatus.target_url || null,
          state: 'success',
          environment: deployment.environment,
          createdAt: deployment.created_at,
        }
      }

      // If still building, return the in-progress state
      const latestStatus = statuses[0]
      if (latestStatus && ['pending', 'in_progress', 'queued'].includes(latestStatus.state)) {
        return {
          url: null,
          state: latestStatus.state === 'queued' ? 'pending' : (latestStatus.state as 'pending' | 'in_progress'),
          environment: deployment.environment,
          createdAt: deployment.created_at,
        }
      }
    }

    return { url: null, state: 'none', environment: null, createdAt: null }
  } catch {
    return { url: null, state: 'none', environment: null, createdAt: null }
  }
}

export async function fetchRepoTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  pathPrefix = 'content/docs'
) {
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: ref,
    recursive: 'true',
  })

  return data.tree
    .filter((item) => {
      if (item.type !== 'blob' || !item.path) return false
      if (!item.path.startsWith(pathPrefix)) return false
      return item.path.endsWith('.mdx') || item.path.endsWith('.md')
    })
    .map((item) => ({
      path: item.path!,
      size: item.size ?? 0,
      sha: item.sha ?? '',
    }))
}

export async function commitChanges(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  changes: { path: string; content: string }[],
  message: string
) {
  // Get the latest commit SHA on the branch
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })
  const latestCommitSha = ref.object.sha

  // Get the tree of the latest commit
  const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha })
  const baseTreeSha = commit.tree.sha

  // Create blobs for each changed file
  const treeItems = await Promise.all(
    changes.map(async ({ path, content }) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content,
        encoding: 'utf-8',
      })
      return {
        path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      }
    })
  )

  // Create a new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  })

  // Create a new commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [latestCommitSha],
  })

  // Update the branch reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  })

  return newCommit.sha
}
