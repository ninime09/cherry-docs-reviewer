export interface PRInfo {
  owner: string
  repo: string
  number: number
  title: string
  branch: string
  baseBranch: string
  state: string
  user: { login: string; avatarUrl: string }
}

export interface PRFile {
  filename: string
  status: string // added, modified, removed, renamed
  additions: number
  deletions: number
  patch?: string
}

export interface AnnotationData {
  id: string
  sessionId: string
  type: 'text' | 'area'
  filePath: string
  locale: string | null
  selectedText: string | null
  globalOffset: number | null
  contextBefore: string | null
  contextAfter: string | null
  sourceLine: number | null
  areaX: number | null
  areaY: number | null
  areaWidth: number | null
  areaHeight: number | null
  comment: string
  reviewer: { id: string; name: string | null; image: string | null }
  status: 'open' | 'done' | 'resolved' | 'wontfix'
  replies: ReplyData[]
  createdAt: string
}

export interface ReplyData {
  id: string
  author: { id: string; name: string | null; image: string | null }
  comment: string
  createdAt: string
}

export interface AIIssue {
  id: string
  line: number
  severity: 'error' | 'warning' | 'info'
  category: string
  description: string
  suggestion: string
  originalText: string
  fixedText: string
}

export interface SessionData {
  id: string
  prUrl: string
  owner: string
  repo: string
  prNumber: number
  branch: string
  title: string | null
  status: string
  createdAt: string
  createdBy: { name: string | null; image: string | null }
  annotationCount: number
  openCount: number
  doneCount: number
  resolvedCount: number
}
