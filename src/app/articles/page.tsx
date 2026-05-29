'use client'

import { useSession, signIn } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn, MessageSquare, FileText, ArrowLeft } from 'lucide-react'

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

interface ArticleItem {
  id: string
  slug: string
  title: string
  digest: string | null
  status: string
  source: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string | null; image: string | null }
  annotationCount: number
}

const STATUS_PILL: Record<string, string> = {
  REVIEWING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  PUBLISHED: 'bg-blue-100 text-blue-800',
  ARCHIVED: 'bg-gray-100 text-gray-500',
}

export default function ArticlesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/articles')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setArticles(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

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
          <h1 className="text-lg font-semibold">Articles</h1>
        </div>
        {session?.user && (
          <div className="flex items-center gap-3">
            <img src={session.user.image || ''} alt="" className="w-8 h-8 rounded-full" />
            <span className="text-sm">{session.user.name}</span>
          </div>
        )}
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        {!session?.user ? (
          <div className="text-center py-20">
            <h2 className="text-3xl font-bold mb-4">Article Review</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Annotate WeChat articles and other long-form content uploaded by the Cherry team.
            </p>
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
              <h2 className="text-xl font-semibold mb-1">Articles in review</h2>
              <p className="text-sm text-gray-500">
                Upload via{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">push_to_reviewer.py</code> from the
                cherry-wechat-publisher skill. A short URL appears here once the article is queued.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading articles…</div>
            ) : articles.length === 0 ? (
              <div className="text-center py-20 border border-dashed rounded-lg">
                <FileText className="mx-auto mb-3 text-gray-400" size={28} />
                <p className="text-gray-500">No articles yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Push from <code>cherry-wechat-publisher</code> to populate this list.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {articles.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => router.push(`/article/${a.slug}`)}
                    className="w-full text-left p-4 border border-border rounded-lg hover:border-accent/50 transition group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ${
                              STATUS_PILL[a.status] || 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {a.status}
                          </span>
                          {a.source && (
                            <span className="text-[10px] text-gray-400">via {a.source}</span>
                          )}
                          {a.createdBy.id === session?.user?.id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                              Yours
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-1.5 truncate">{a.title}</p>
                        {a.digest && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{a.digest}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          {a.createdBy.image && (
                            <img src={a.createdBy.image} alt="" className="w-4 h-4 rounded-full" />
                          )}
                          <span>{a.createdBy.name || 'Unknown'}</span>
                          <span className="text-gray-300">·</span>
                          <span title={`Created ${new Date(a.createdAt).toLocaleString()}`}>
                            {formatRelativeTime(a.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1 text-sm text-gray-500">
                        <MessageSquare size={14} />
                        {a.annotationCount}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
