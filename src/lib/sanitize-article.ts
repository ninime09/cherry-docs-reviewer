/**
 * Sanitize a full HTML page produced by cherry-wechat-publisher (or any tool
 * following the same shell convention) into a body-only fragment safe to
 * render via dangerouslySetInnerHTML on the article page.
 *
 *  - Removes <script>, <style>, <link> blocks (publisher shell ships these
 *    for the local preview UI; they have no business in the reviewer).
 *  - If a <div id="content"> exists, returns its inner HTML (so the
 *    "复制全文到公众号" toolbar and 420px preview-wrap container don't
 *    leak into the reviewer).
 *  - Otherwise returns the cleaned HTML as-is.
 *
 * This is intentionally conservative — we trust the input source
 * (publisher / authenticated team members) and only strip the *shell*
 * bits that are known to be wrong on the reviewer surface.
 */
export function sanitizeArticleHtml(html: string): string {
  let cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<link\b[^>]*\/?>/gi, '')

  const startMatch = cleaned.match(/<div\s+[^>]*\bid=["']content["'][^>]*>/i)
  if (!startMatch || startMatch.index === undefined) {
    return cleaned.trim()
  }

  const startIdx = startMatch.index + startMatch[0].length

  // Walk forward tracking nested <div> to find the matching close tag.
  let depth = 1
  let i = startIdx
  while (i < cleaned.length && depth > 0) {
    const nextOpen = cleaned.toLowerCase().indexOf('<div', i)
    const nextClose = cleaned.toLowerCase().indexOf('</div>', i)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 4
    } else {
      depth -= 1
      if (depth === 0) {
        return cleaned.slice(startIdx, nextClose).trim()
      }
      i = nextClose + 6
    }
  }

  return cleaned.slice(startIdx).trim()
}
