'use client'

import { useSession, signIn } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Check, Trash2, KeyRound, LogIn } from 'lucide-react'

interface ApiTokenItem {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  createdAt: string
}

interface NewToken extends ApiTokenItem {
  plaintext: string
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString()
}

export default function TokensPage() {
  const { data: session, status } = useSession()
  const [tokens, setTokens] = useState<ApiTokenItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [newToken, setNewToken] = useState<NewToken | null>(null)
  const [copied, setCopied] = useState(false)

  function refresh() {
    setLoading(true)
    fetch('/api/tokens')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTokens(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (session?.user) refresh()
  }, [session])

  async function createToken() {
    if (!newName.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const r = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed')
      setNewToken(data)
      setNewName('')
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create token')
    } finally {
      setCreating(false)
    }
  }

  async function revokeToken(id: string) {
    if (!confirm('Revoke this token? Any CLI / scripts using it will stop working.')) return
    await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
    refresh()
  }

  async function copyPlaintext() {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken.plaintext)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-foreground flex items-center gap-1">
            <ArrowLeft size={14} />
            Home
          </Link>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-500">Settings</span>
          <span className="text-gray-300">·</span>
          <h1 className="text-lg font-semibold">API Tokens</h1>
        </div>
        {session?.user && (
          <div className="flex items-center gap-3">
            <img src={session.user.image || ''} alt="" className="w-8 h-8 rounded-full" />
            <span className="text-sm">{session.user.name}</span>
          </div>
        )}
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        {!session?.user ? (
          <div className="text-center py-20">
            <KeyRound className="mx-auto mb-4 text-gray-400" size={32} />
            <h2 className="text-2xl font-bold mb-3">API Tokens</h2>
            <p className="text-gray-500 mb-8">Sign in to manage personal access tokens for CLI integrations.</p>
            <button
              onClick={() => signIn('github')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:opacity-90 transition"
            >
              <LogIn size={18} />
              Sign in with GitHub
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-1">Personal access tokens</h2>
              <p className="text-sm text-gray-500">
                Tokens authenticate command-line tools (like{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">push_to_reviewer.py</code>) in place of
                your browser cookie. Each token acts as your account — keep it secret. You can revoke any token
                at any time.
              </p>
            </div>

            {/* One-time reveal for newly created token */}
            {newToken && (
              <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900">
                <p className="text-sm font-semibold mb-2">Copy your new token now — it won&apos;t be shown again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-black/10 dark:bg-black/40 px-3 py-2 text-xs font-mono">
                    {newToken.plaintext}
                  </code>
                  <button
                    onClick={copyPlaintext}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 text-white px-3 py-2 text-xs font-medium hover:bg-amber-800"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs">
                  Paste into <code className="bg-black/10 dark:bg-black/40 px-1 rounded">~/.config/cherry-studio/reviewer.env</code> as
                  {' '}
                  <code className="bg-black/10 dark:bg-black/40 px-1 rounded">REVIEWER_API_TOKEN=…</code>
                </p>
                <button
                  onClick={() => setNewToken(null)}
                  className="mt-3 text-xs underline opacity-80 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Create form */}
            <div className="mb-10">
              <label className="block text-sm font-medium mb-2">Create a new token</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="publisher CLI"
                  className="flex-1 px-4 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  onKeyDown={(e) => e.key === 'Enter' && createToken()}
                />
                <button
                  onClick={createToken}
                  disabled={creating || !newName.trim()}
                  className="px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
                >
                  {creating ? 'Creating…' : 'Generate'}
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            {/* Token list */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-gray-500 uppercase tracking-wider">
                Active tokens ({tokens.length})
              </h3>
              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading…</div>
              ) : tokens.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg text-gray-500 text-sm">
                  No tokens yet. Generate one above.
                </div>
              ) : (
                <div className="space-y-2">
                  {tokens.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{t.prefix}…</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Created {formatRelativeTime(t.createdAt)} · Last used {formatRelativeTime(t.lastUsedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => revokeToken(t.id)}
                        className="shrink-0 inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 size={12} />
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
