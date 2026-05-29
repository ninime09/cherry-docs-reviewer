import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTokenPlaintext, hashToken, tokenPrefixForDisplay } from '@/lib/tokens'

// Token CRUD intentionally requires NextAuth session, NOT a Bearer token.
// You shouldn't be able to mint or revoke tokens with a token — that would
// turn a leaked CLI token into a credential-expander.

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  })

  return Response.json(
    tokens.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.prefix,
      lastUsedAt: t.lastUsedAt?.toISOString() || null,
      createdAt: t.createdAt.toISOString(),
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name } = await req.json()
  if (typeof name !== 'string' || !name.trim()) {
    return Response.json({ error: 'Missing token name' }, { status: 400 })
  }
  if (name.length > 64) {
    return Response.json({ error: 'Name too long (max 64)' }, { status: 400 })
  }

  const plaintext = generateTokenPlaintext()
  const created = await prisma.apiToken.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      tokenHash: hashToken(plaintext),
      prefix: tokenPrefixForDisplay(plaintext),
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
    },
  })

  // The plaintext token is returned exactly once. After this response leaves
  // the server, only the hash is retrievable.
  return Response.json(
    {
      ...created,
      createdAt: created.createdAt.toISOString(),
      plaintext,
    },
    { status: 201 }
  )
}
