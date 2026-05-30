/**
 * Wrap a stripped article body (the sanitized htmlSnapshot we store in the DB)
 * back into the cherry-wechat-publisher "preview shell" — the standalone HTML
 * the publisher pipeline originally produces.
 *
 * The shell gives the user:
 *   - A 420px-wide phone-style preview card
 *   - A sticky "复制全文到公众号" button that selects #content and
 *     execCommand('copy')s it into the clipboard
 *   - All article inline styles preserved (we never strip those)
 *
 * Source of truth: ~/.claude/skills/cherry-wechat-publisher/references/template.md
 * Keep this template in sync whenever publisher's shell changes.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function wrapArticleInPublisherShell(opts: {
  title: string
  contentHtml: string
}): string {
  const title = escapeHtml(opts.title)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 公众号预览</title>
  <style>
    /* ===== Preview shell — stripped automatically when copied into the WeChat editor ===== */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #ededed;
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #fff;
      border-bottom: 1px solid #e5e5e5;
      padding: 14px 16px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .toolbar button {
      background: #27282d;
      color: #fff;
      border: none;
      padding: 10px 32px;
      border-radius: 6px;
      font-size: 15px;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s;
    }
    .toolbar button:hover { background: #444; }
    .toolbar .hint {
      display: block;
      font-size: 12px;
      color: #999;
      margin-top: 6px;
    }
    .preview-wrap {
      max-width: 420px;
      margin: 24px auto;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      padding: 24px 0;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="copyBtn" onclick="copyContent()">复制全文到公众号</button>
    <span class="hint">点击复制 → 打开公众号编辑器 → Ctrl+V 粘贴，格式自动保留</span>
  </div>
  <div class="preview-wrap">
    <div id="content">
${opts.contentHtml}
    </div>
  </div>
  <script>
  function copyContent() {
    const content = document.getElementById('content');
    const range = document.createRange();
    range.selectNodeContents(content);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    try {
      document.execCommand('copy');
      const btn = document.getElementById('copyBtn');
      btn.textContent = '已复制';
      btn.style.background = '#F66A67';
      setTimeout(() => {
        btn.textContent = '复制全文到公众号';
        btn.style.background = '#27282d';
      }, 2000);
    } catch (e) {
      alert('复制失败，请手动全选正文区域后复制');
    }
    sel.removeAllRanges();
  }
  </script>
</body>
</html>`
}
