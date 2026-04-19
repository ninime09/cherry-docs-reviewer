'use client'

import { ReactNode } from 'react'
import { Info, AlertCircle, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'

/**
 * Stub implementations of Fumadocs UI components. Gives the Annotate mode
 * a clean, readable look while keeping all text selectable for annotation.
 *
 * All image-rendering components MUST go through the `Img` component (defined
 * inside makeMdxComponents) so their src paths are resolved to GitHub raw URLs.
 */

// ---------- Simple text components (don't render images) ----------

interface CardProps {
  title?: string
  description?: string
  href?: string
  icon?: ReactNode
  children?: ReactNode
}

function Card({ title, description, href, icon, children }: CardProps) {
  const content = (
    <>
      {icon && <div className="mb-2 text-accent">{icon}</div>}
      {title && <div className="font-semibold text-sm mb-1">{title}</div>}
      {description && <div className="text-xs text-gray-500">{description}</div>}
      {children && <div className="text-sm mt-2">{children}</div>}
    </>
  )
  const baseClass =
    'block rounded-xl border border-border p-4 transition hover:border-accent/50 hover:bg-muted/30'
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={baseClass}>
        {content}
      </a>
    )
  }
  return <div className={baseClass}>{content}</div>
}

function Cards({ children }: { children?: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">{children}</div>
}

interface CalloutProps {
  type?: 'info' | 'warn' | 'warning' | 'error' | 'success' | 'tip'
  title?: string
  children?: ReactNode
}

function Callout({ type = 'info', title, children }: CalloutProps) {
  const styles = {
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: <Info size={16} /> },
    warn: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', icon: <AlertTriangle size={16} /> },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', icon: <AlertTriangle size={16} /> },
    error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: <AlertCircle size={16} /> },
    success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', icon: <CheckCircle2 size={16} /> },
    tip: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', icon: <HelpCircle size={16} /> },
  }
  const s = styles[type] || styles.info
  return (
    <div className={`my-4 rounded-lg border ${s.border} ${s.bg} p-4`}>
      <div className={`flex gap-3 ${s.text}`}>
        <div className="shrink-0 mt-0.5">{s.icon}</div>
        <div className="flex-1 text-sm">
          {title && <div className="font-semibold mb-1">{title}</div>}
          <div>{children}</div>
        </div>
      </div>
    </div>
  )
}

function Steps({ children }: { children?: ReactNode }) {
  return <div className="my-4 pl-6 border-l-2 border-border space-y-4 mdx-steps">{children}</div>
}

function Step({ children }: { children?: ReactNode }) {
  return <div className="mdx-step relative">{children}</div>
}

function Tabs({ children, items }: { children?: ReactNode; items?: string[] }) {
  return (
    <div className="my-4 border border-border rounded-lg overflow-hidden">
      {items && (
        <div className="flex border-b border-border bg-muted/30">
          {items.map((item, i) => (
            <div
              key={item}
              className={`px-3 py-1.5 text-xs font-medium border-r border-border ${
                i === 0 ? 'bg-background text-foreground' : 'text-gray-500'
              }`}
            >
              {item}
            </div>
          ))}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  )
}

function Tab({ children }: { children?: ReactNode }) {
  return <div>{children}</div>
}

function Accordion({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <details className="my-3 border border-border rounded-lg overflow-hidden group">
      <summary className="px-3 py-2 cursor-pointer bg-muted/30 hover:bg-muted text-sm font-medium">
        {title}
      </summary>
      <div className="p-3 text-sm">{children}</div>
    </details>
  )
}

function Accordions({ children }: { children?: ReactNode }) {
  return <div className="my-4">{children}</div>
}

function ExperienceCard({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <Card title={title}>
      <div className="text-xs text-gray-500">{children}</div>
    </Card>
  )
}

function ExperienceCards({ children }: { children?: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">{children}</div>
}

function UnknownComponent({
  name,
  children,
  ...props
}: { name: string; children?: ReactNode } & Record<string, unknown>) {
  const propEntries = Object.entries(props).filter(([k]) => k !== 'key')
  return (
    <div className="my-3 rounded-lg border border-dashed border-gray-300 bg-muted/30 p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[10px] text-gray-500 bg-background px-1.5 py-0.5 rounded border border-border">
          {name}
        </span>
        <span className="text-[10px] text-gray-400">(unknown component — showing as placeholder)</span>
      </div>
      {propEntries.length > 0 && (
        <div className="space-y-1 mb-2 pl-2 border-l-2 border-gray-200">
          {propEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-gray-500 font-mono shrink-0">{k}:</span>
              <span className="text-gray-700">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {children && <div className="text-gray-700">{children}</div>}
    </div>
  )
}

// ---------- Component map factory ----------

interface LocalizedImageProps {
  src?: string
  alt?: string
  srcMap?: Record<string, string>
  locale?: string
}

interface ImageStepsProps {
  images?: Array<{ src: string; alt?: string; caption?: string }>
  children?: ReactNode
}

export function makeMdxComponents(ctx: {
  owner: string
  repo: string
  gitRef: string
  locale?: string
}) {
  function resolveSrc(src?: string): string {
    if (!src) return ''
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src
    // Paths starting with / are relative to /public in the docs repo
    const path = src.startsWith('/') ? `public${src}` : src
    return `https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${ctx.gitRef}/${path}`
  }

  // Every image in the preview goes through this component so its src is
  // always resolved to an absolute GitHub raw URL.
  function Img(props: React.ImgHTMLAttributes<HTMLImageElement>) {
    const { src, className, ...rest } = props
    const rawSrc = typeof src === 'string' ? src : undefined
    const resolved = resolveSrc(rawSrc)
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return (
      <img
        {...rest}
        src={resolved}
        className={className || 'my-4 max-w-full rounded-lg border border-border'}
      />
    )
  }

  function LocalizedImage({ src, alt, srcMap }: LocalizedImageProps) {
    // Try: ctx.locale → 'en' → any first value in srcMap → raw src
    const keyOrder = [ctx.locale, 'en'].filter(Boolean) as string[]
    let rawSrc = src
    if (srcMap) {
      for (const k of keyOrder) {
        if (srcMap[k]) {
          rawSrc = srcMap[k]
          break
        }
      }
      if (!rawSrc) {
        const first = Object.values(srcMap)[0]
        if (first) rawSrc = first
      }
    }
    return <Img src={rawSrc} alt={alt} />
  }

  function ImageSteps({ images, children }: ImageStepsProps) {
    if (!images) return <div className="my-4">{children}</div>
    return (
      <div className="my-4 space-y-3">
        {images.map((img, i) => (
          <div key={i} className="border border-border rounded-lg overflow-hidden">
            <Img src={img.src} alt={img.alt || ''} className="w-full" />
            {img.caption && (
              <div className="px-3 py-1.5 text-xs text-gray-500 bg-muted/30 border-t border-border">
                {i + 1}. {img.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  const explicit: Record<string, React.ComponentType<Record<string, unknown>>> = {
    // Core Fumadocs components
    Card: Card as React.ComponentType<Record<string, unknown>>,
    Cards: Cards as React.ComponentType<Record<string, unknown>>,
    Callout: Callout as React.ComponentType<Record<string, unknown>>,
    Steps: Steps as React.ComponentType<Record<string, unknown>>,
    Step: Step as React.ComponentType<Record<string, unknown>>,
    Tabs: Tabs as React.ComponentType<Record<string, unknown>>,
    Tab: Tab as React.ComponentType<Record<string, unknown>>,
    Accordion: Accordion as React.ComponentType<Record<string, unknown>>,
    Accordions: Accordions as React.ComponentType<Record<string, unknown>>,

    // Image-rendering components (all go through Img internally)
    ImageSteps: ImageSteps as React.ComponentType<Record<string, unknown>>,
    LocalizedImage: LocalizedImage as React.ComponentType<Record<string, unknown>>,

    // Other custom components
    ExperienceCard: ExperienceCard as React.ComponentType<Record<string, unknown>>,
    ExperienceCards: ExperienceCards as React.ComponentType<Record<string, unknown>>,

    // Native HTML <img> override
    img: Img as unknown as React.ComponentType<Record<string, unknown>>,
  }

  return new Proxy(explicit, {
    get(target, prop) {
      if (prop in target) return target[prop as string]
      if (typeof prop !== 'string') return undefined
      if (!/^[A-Z]/.test(prop)) return undefined
      const Fallback = (props: Record<string, unknown>) => (
        <UnknownComponent name={prop} {...props} />
      )
      Fallback.displayName = `Unknown(${prop})`
      return Fallback
    },
  })
}
