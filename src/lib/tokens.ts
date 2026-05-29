import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { prisma } from './prisma'

const PREFIX = 'cdr_' // cherry-docs-reviewer

/**
 * Generate a new plaintext token. Format: `cdr_<48 hex chars>`.
 * Caller stores only the hash; the plaintext is shown to the user once.
 */
export function generateTokenPlaintext(): string {
  return PREFIX + randomBytes(24).toString('hex')
}

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Look up an API token by its plaintext value. Returns the owning user and the
 * token id, or null if the token doesn't exist or has been revoked. Touches
 * lastUsedAt as a side effect.
 *
 * timingSafeEqual is overkill here since the lookup is by indexed hash (constant
 * time at the DB level), but the cost is trivial and removes one class of
 * worry.
 */
export async function findUserByTokenPlaintext(
  plaintext: string
): Promise<{ userId: string; tokenId: string } | null> {
  if (!plaintext.startsWith(PREFIX)) return null
  const hash = hashToken(plaintext)
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, userId: true, tokenHash: true },
  })
  if (!token) return null

  // Constant-time compare as belt-and-suspenders
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(token.tokenHash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // Don't block on this — best-effort lastUsedAt update.
  prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return { userId: token.userId, tokenId: token.id }
}

export function tokenPrefixForDisplay(plaintext: string): string {
  return plaintext.slice(0, 12)
}
