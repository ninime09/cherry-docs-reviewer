import type { NextRequest } from 'next/server'
import { auth } from './auth'
import { findUserByTokenPlaintext } from './tokens'

export interface ApiAuthUser {
  id: string
  /** "session" for NextAuth cookie, "token" for Bearer API token. */
  via: 'session' | 'token'
}

/**
 * Dual-track auth for API routes.
 *
 *   1. If the request carries `Authorization: Bearer cdr_…`, validate the token
 *      and return the owning user.
 *   2. Otherwise fall back to the NextAuth session cookie.
 *
 * Returns null when neither is valid. Callers should respond 401 in that case.
 *
 * The two paths intentionally diverge in capability:
 *   - Token holders can do anything a logged-in user can on the API surface.
 *   - But they cannot create or revoke tokens — that path checks `via === 'session'`.
 */
export async function getApiAuthUser(req: NextRequest): Promise<ApiAuthUser | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const plaintext = authHeader.slice(7).trim()
    const result = await findUserByTokenPlaintext(plaintext)
    if (result) return { id: result.userId, via: 'token' }
    // Explicitly do NOT fall back to session when a Bearer header was
    // provided but failed — that would mask credential bugs in CLIs.
    return null
  }

  const session = await auth()
  if (session?.user?.id) return { id: session.user.id, via: 'session' }
  return null
}
