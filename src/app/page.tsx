'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, LogOut, Plus, ExternalLink, MessageSquare } from 'lucide-react'

function formatRelativeTime(iso: string): string {
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

interface SessionItem {
  id: string
  prUrl: string
  owner: string
  repo: string
  prNumber: number
  title: string | null
  status: string
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string | null; image: string | null }
  annotationCount: number
}

export default function Home() {
  const { data: session, status } = useSession()
  const [prUrl, setPrUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (session?.user) {
      fetch('/api/sessions')
        .then((r) => r.json())
        .then(setSessions)
        .catch(() => {})
    }
  }, [session])

  async function createSession() {
    if (!prUrl.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prUrl }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create session')
      }
      const data = await res.json()
      router.push(`/review/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
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
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">
            CR
          </div>
          <h1 className="text-lg font-semibold">Cherry Docs Reviewer</h1>
        </div>
        {session?.user ? (
          <div className="flex items-center gap-3">
            <img
              src={session.user.image || ''}
              alt=""
              className="w-8 h-8 rounded-full"
            />
            <span className="text-sm">{session.user.name}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-foreground flex items-center gap-1"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn('github')}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90"
          >
            <LogIn size={16} />
            Sign in with GitHub
          </button>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        {!session?.user ? (
          <div className="text-center py-20">
            <h2 className="text-3xl font-bold mb-4">Documentation Review Tool</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Review Cherry Studio enterprise docs with inline annotations,
              AI-powered issue detection, and team collaboration.
            </p>
            <button
              onClick={() => signIn('github')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:opacity-90 transition"
            >
              <LogIn size={18} />
              Sign in with GitHub to get started
            </button>
          </div>
        ) : (
          <>
            {/* PR URL Input */}
            <div className="mb-10">
              <h2 className="text-xl font-semibold mb-4">Start a New Review</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={prUrl}
                  onChange={(e) => setPrUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo/pull/123"
                  className="flex-1 px-4 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  onKeyDown={(e) => e.key === 'Enter' && createSession()}
                />
                <button
                  onClick={createSession}
                  disabled={loading || !prUrl.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
                >
                  <Plus size={16} />
                  {loading ? 'Creating...' : 'Review'}
                </button>
              </div>
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>

            {/* Session List */}
            {sessions.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Review Sessions</h2>
                <div className="space-y-3">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/review/${s.id}`)}
                      className="w-full text-left p-4 border border-border rounded-lg hover:border-accent/50 transition group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-gray-500">
                              {s.owner}/{s.repo}#{s.prNumber}
                            </span>
                            <ExternalLink
                              size={12}
                              className="text-gray-400 group-hover:text-accent transition"
                            />
                            {s.createdBy.id === session?.user?.id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                                Yours
                              </span>
                            )}
                          </div>
                          {s.title && (
                            <p className="text-sm mt-1 truncate">{s.title}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                            {s.createdBy.image && (
                              <img
                                src={s.createdBy.image}
                                alt=""
                                className="w-4 h-4 rounded-full"
                              />
                            )}
                            <span>{s.createdBy.name || 'Unknown'}</span>
                            <span className="text-gray-300">·</span>
                            <span title={`Created ${new Date(s.createdAt).toLocaleString()}`}>
                              {formatRelativeTime(s.updatedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1 text-sm text-gray-500">
                          <MessageSquare size={14} />
                          {s.annotationCount}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
