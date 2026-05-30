/**
 * Fire-and-forget Feishu webhook helper.
 *
 * Configuration:
 *   FEISHU_WEBHOOK_URL  — incoming webhook URL of a Feishu custom bot.
 *   FEISHU_WEBHOOK_SECRET — (optional) signing secret if the bot is configured
 *                            with "签名校验" enabled. When set we append a timestamp
 *                            and HMAC-SHA256 sign to the payload.
 *   FEISHU_WEBHOOK_DRY_RUN — set to "true" to log payloads without POSTing.
 *
 * All notifications no-op silently if FEISHU_WEBHOOK_URL is missing — the
 * reviewer keeps working, just without group notifications.
 */

import crypto from 'node:crypto'

interface CardField {
  title: string
  body: string
  href: string
  ctaLabel?: string
  reviewerName?: string
}

function publicArticleUrl(slugOrId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://cherry-docs-reviewer.vercel.app'
  return `${base.replace(/\/$/, '')}/article/${encodeURIComponent(slugOrId)}`
}

function buildFeishuCard(field: CardField) {
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: field.title },
        template: 'turquoise',
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content: field.body },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: field.ctaLabel || '打开 reviewer' },
              type: 'primary',
              url: field.href,
            },
          ],
        },
      ],
    },
  }
}

async function postWebhook(body: object) {
  const url = process.env.FEISHU_WEBHOOK_URL
  if (!url) return // graceful no-op when the integration isn't configured

  let payload: Record<string, unknown> = { ...body }
  const secret = process.env.FEISHU_WEBHOOK_SECRET
  if (secret) {
    // Feishu's incoming-bot signing scheme:
    //   sign = base64(hmac_sha256(stringToSign, secret))
    //   stringToSign = `${timestamp}\n${secret}`
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const stringToSign = `${timestamp}\n${secret}`
    const sign = crypto.createHmac('sha256', Buffer.from(stringToSign)).update('').digest('base64')
    payload = { ...payload, timestamp, sign }
  }

  if (process.env.FEISHU_WEBHOOK_DRY_RUN === 'true') {
    console.log('[feishu webhook DRY RUN]', JSON.stringify(payload, null, 2))
    return
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      console.warn(`[feishu webhook] ${r.status} ${await r.text().catch(() => '')}`)
    }
  } catch (err) {
    console.warn('[feishu webhook] POST failed:', err)
  }
}

// Fire-and-forget wrapper so callers in route handlers don't await the network.
function fireAndForget(promise: Promise<unknown>) {
  promise.catch((err) => console.warn('[feishu webhook] background failure:', err))
}

// ----- Public events -----

export function notifyArticleCreated(article: { slug: string; title: string; createdBy?: { name?: string | null } | null }) {
  const body = [
    `**${article.title}**`,
    article.createdBy?.name ? `推送：${article.createdBy.name}` : null,
    '',
    '审核人请打开链接划选文字 / 点击图片批注。',
  ]
    .filter(Boolean)
    .join('\n')
  fireAndForget(
    postWebhook(
      buildFeishuCard({
        title: '📝 新文章待审',
        body,
        href: publicArticleUrl(article.slug),
        ctaLabel: '去批注',
      })
    )
  )
}

export function notifyAgentEdited(opts: {
  article: { slug: string; title: string }
  resolvedCount: number
}) {
  const body = `**${opts.article.title}**\n\nAgent 已处理 ${opts.resolvedCount} 条批注（status → resolved），请审核人复审。\n\n满意点 ✓ Done，不满意点 ✎ Re-open & Edit。`
  fireAndForget(
    postWebhook(
      buildFeishuCard({
        title: '✨ 改稿完成，请复审',
        body,
        href: publicArticleUrl(opts.article.slug),
        ctaLabel: '去复审',
      })
    )
  )
}
