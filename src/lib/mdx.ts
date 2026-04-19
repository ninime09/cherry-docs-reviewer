import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'

export async function compileMdx(source: string) {
  const result = await compile(source, {
    outputFormat: 'function-body',
    remarkPlugins: [remarkGfm],
    development: false,
  })
  return String(result)
}
