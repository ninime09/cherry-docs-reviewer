import { visit } from 'unist-util-visit'
import type { Root } from 'hast'

interface Options {
  owner: string
  repo: string
  gitRef: string
}

/**
 * Rewrites relative image URLs (starting with /) to absolute GitHub raw URLs.
 * Applied at MDX compile time, so even images inside custom components
 * get their src rewritten before they reach the React renderer.
 *
 * Handles:
 *   - <img src="/assets/..." /> HTML elements
 *   - MDX JSX elements like <LocalizedImage src="/assets/..." /> and srcMap
 */
export function rehypeRewriteAssets(options: Options) {
  const { owner, repo, gitRef } = options

  function resolve(src: string): string {
    if (!src) return src
    if (src.startsWith('http://') || src.startsWith('https://')) return src
    if (src.startsWith('data:')) return src
    const path = src.startsWith('/') ? `public${src}` : src
    return `https://raw.githubusercontent.com/${owner}/${repo}/${gitRef}/${path}`
  }

  return function transformer(tree: Root) {
    // Visit all element nodes (including MDX JSX elements)
    visit(tree, (node: unknown) => {
      const n = node as {
        type: string
        tagName?: string
        name?: string
        properties?: Record<string, unknown>
        attributes?: Array<{
          type: string
          name: string
          value: unknown
        }>
      }

      // Standard HTML <img> element
      if (n.type === 'element' && n.tagName === 'img' && n.properties) {
        const src = n.properties.src
        if (typeof src === 'string') {
          n.properties.src = resolve(src)
        }
      }

      // MDX JSX element: any component with attributes named `src` or `srcMap`
      if (
        (n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement') &&
        Array.isArray(n.attributes)
      ) {
        for (const attr of n.attributes) {
          if (attr.type !== 'mdxJsxAttribute') continue
          if (attr.name === 'src' && typeof attr.value === 'string') {
            attr.value = resolve(attr.value)
          }
          // srcMap={{ en: '/x.webp', zh: '/y.webp' }} — rewrite each entry
          if (attr.name === 'srcMap' && attr.value && typeof attr.value === 'object') {
            const v = attr.value as { value?: string; type?: string }
            if (v.type === 'mdxJsxAttributeValueExpression' && typeof v.value === 'string') {
              v.value = v.value.replace(
                /(['"])(\/[^'"]+\.(?:webp|png|jpe?g|gif|svg|avif))\1/gi,
                (_, quote, path) => `${quote}${resolve(path)}${quote}`
              )
            }
          }
        }
      }
    })
  }
}
