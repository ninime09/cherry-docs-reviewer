'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, LogOut, Plus, ExternalLink, MessageSquare } from 'lucide-react'

interface SessionItem {
  id: string
  prUrl: string
  owner: string
  repo: string
  prNumber: number
  title: string | null
  status: string
  createdAt: string
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
                <h2 className="text-xl font-semibold mb-4">Recent Reviews</h2>
                <div className="space-y-3">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/review/${s.id}`)}
                      className="w-full text-left p-4 border border-border rounded-lg hover:border-accent/50 transition group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-mono text-gray-500">
                            {s.owner}/{s.repo}#{s.prNumber}
                          </span>
                          <ExternalLink
                            size={12}
                            className="text-gray-400 group-hover:text-accent transition"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <MessageSquare size={14} />
                          {s.annotationCount}
                        </div>
                      </div>
                      {s.title && (
                        <p className="text-sm mt-1 truncate">{s.title}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
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
