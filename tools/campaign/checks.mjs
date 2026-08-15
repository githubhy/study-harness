const EXTERNAL = /<script|<link\b|@import|\bsrc=|@font-face/i
const PAIRED = ['div', 'section', 'article', 'figure', 'table', 'svg', 'nav', 'main', 'dl', 'ul', 'p', 'span']

export function checkHtml(html, { anchors = true } = {}) {
  const problems = []

  const idx = html.indexOf('<meta charset="utf-8">')
  if (idx === -1) problems.push('missing <meta charset="utf-8">')
  else if (Buffer.byteLength(html.slice(0, idx), 'utf8') > 1024)
    problems.push('<meta charset="utf-8"> appears beyond the first 1024 bytes')

  if (EXTERNAL.test(html)) problems.push('external reference found (script/link/@import/src/@font-face)')
  if (/<details\b/i.test(html)) problems.push('<details> element found; nothing may collapse')

  // Tokens must be defined in the FIRST (bare) :root block.
  const bare = html.match(/:root\s*\{([^}]*)\}/)
  const defined = new Set([...(bare?.[1] ?? '').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  for (const m of html.matchAll(/var\((--[a-z0-9-]+)/g))
    if (!defined.has(m[1])) problems.push(`token ${m[1]} used but not defined in the bare :root`)

  if (!/body\s*\{[^}]*background\s*:\s*var\(--/.test(html))
    problems.push('body does not set background from a token')

  if (anchors) {
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
    for (const m of html.matchAll(/href="#([^"]+)"/g))
      if (!ids.has(m[1])) problems.push(`dangling anchor #${m[1]}`)
  }

  for (const tag of PAIRED) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
    if (open !== close) problems.push(`unbalanced <${tag}>: ${open} open, ${close} close`)
  }

  return problems
}
