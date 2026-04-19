'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'

interface FileItem {
  path: string
  size: number
  sha: string
}

interface TreeNode {
  name: string
  path: string
  isFile: boolean
  children: TreeNode[]
}

interface AllFilesBrowserProps {
  files: FileItem[]
  selectedFile: string | null
  annotationCountByFile: Map<string, number>
  onSelectFile: (path: string) => void
}

function buildTree(files: FileItem[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isFile: false, children: [] }

  for (const file of files) {
    const parts = file.path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isLast = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')

      let child = current.children.find((c) => c.name === name)
      if (!child) {
        child = { name, path, isFile: isLast, children: [] }
        current.children.push(child)
      }
      current = child
    }
  }

  // Sort: folders first, then files, both alphabetically
  const sort = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sort)
  }
  sort(root)

  return root
}

function TreeNodeView({
  node,
  depth,
  selectedFile,
  annotationCountByFile,
  onSelectFile,
  defaultExpanded,
}: {
  node: TreeNode
  depth: number
  selectedFile: string | null
  annotationCountByFile: Map<string, number>
  onSelectFile: (path: string) => void
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (node.isFile) {
    const count = annotationCountByFile.get(node.path) ?? 0
    return (
      <button
        onClick={() => onSelectFile(node.path)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`w-full text-left py-1 pr-2 text-xs flex items-center gap-1.5 hover:bg-muted transition ${
          selectedFile === node.path ? 'bg-accent-light border-l-2 border-l-accent' : ''
        }`}
      >
        <FileText size={11} className="shrink-0 text-gray-400" />
        <span className="truncate font-mono">{node.name}</span>
        {count > 0 && (
          <span className="ml-auto w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center shrink-0">
            {count}
          </span>
        )}
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        className="w-full text-left py-1 pr-2 text-xs flex items-center gap-1 hover:bg-muted transition text-gray-500"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {expanded ? (
          <FolderOpen size={11} className="text-gray-400" />
        ) : (
          <Folder size={11} className="text-gray-400" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {expanded &&
        node.children.map((child) => (
          <TreeNodeView
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            annotationCountByFile={annotationCountByFile}
            onSelectFile={onSelectFile}
            defaultExpanded={depth < 2}
          />
        ))}
    </div>
  )
}

export default function AllFilesBrowser({
  files,
  selectedFile,
  annotationCountByFile,
  onSelectFile,
}: AllFilesBrowserProps) {
  const tree = useMemo(() => buildTree(files), [files])

  if (files.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-400 text-center">
        No files loaded yet
      </div>
    )
  }

  return (
    <div>
      {tree.children.map((child) => (
        <TreeNodeView
          key={child.path}
          node={child}
          depth={0}
          selectedFile={selectedFile}
          annotationCountByFile={annotationCountByFile}
          onSelectFile={onSelectFile}
          defaultExpanded={true}
        />
      ))}
    </div>
  )
}
