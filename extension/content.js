// Cherry Docs Reviewer Helper — iframe URL sync
//
// Runs inside any Vercel preview iframe. Detects SPA navigation (which is
// invisible to our review tool due to the cross-origin sandbox) and
// postMessages the current path back to the parent window.
//
// The review tool listens for `{ type: 'cherry-docs-reviewer:iframe-nav' }`
// messages and updates its URL bar automatically.

;(function () {
  // Only activate when this script is running inside an iframe.
  if (window.self === window.top) return

  let lastHref = location.href

  function sendIfChanged() {
    if (location.href === lastHref) return
    lastHref = location.href
    try {
      window.parent.postMessage(
        {
          type: 'cherry-docs-reviewer:iframe-nav',
          href: location.href,
          pathname: location.pathname + location.search + location.hash,
        },
        '*'
      )
    } catch {
      // Parent may have been unloaded; ignore
    }
  }

  // Send initial URL once the page has settled.
  setTimeout(sendIfChanged, 200)

  // Poll every 500ms. Cheap and catches any SPA navigation pattern
  // (pushState, replaceState, hash changes, full reloads).
  setInterval(sendIfChanged, 500)

  // Also respond to native history events for snappier updates.
  window.addEventListener('popstate', sendIfChanged)
  window.addEventListener('hashchange', sendIfChanged)
})()
