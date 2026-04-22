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
  // text: drag-selected text | image: whole image | area: image region
  type: 'text' | 'image' | 'area'
  filePath: string
  locale: string | null
  // For text annotations: the selected text.
  // For image/area annotations: the image's alt text (may be empty).
  selectedText: string | null
  globalOffset: number | null
  // For text annotations: context around the selection.
  // For image/area annotations (overloaded): the image src URL for thumbnail.
  contextBefore: string | null
  contextAfter: string | null
  sourceLine: number | null
  // For area annotations only: region coords as normalized 0-1 values.
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
