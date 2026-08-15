import { esc, attr } from './html.mjs'

const COL = 170, ROW = 46, PAD = 26, W = 62, H = 26

// Takes the whole model for symmetry with the other renderers; everything it draws — bands,
// nodes, edges — now comes off `derived`.
export function renderGraph({ derived }) {
  // derived.edges mixes thread -> thread ('opened', from a logged question) and thread ->
  // phase ('gates'). Only 'opened' edges connect two nodes on this graph; gate relationships
  // are already drawn on the roadmap's dependency map, so duplicating them here as dangling
  // half-edges would add noise, not information. Filter to the kind explicitly, rather than
  // leaning on a later pos.has() lookup to silently drop the gates edges.
  const opened = derived.edges.filter((e) => e.kind === 'opened')
  if (opened.length === 0) return ''

  // Column per band, row per thread within it, both straight from derived.bands — the same
  // ordering §4 and the coverage strip use. A node's position is where the strip's letter is, or
  // the two disagree the moment a letter is not a single uppercase character.
  const pos = new Map()
  derived.bands.forEach((band, col) => {
    band.threads.forEach((t, row) => pos.set(t.letter, { x: PAD + col * COL, y: PAD + row * ROW }))
  })

  const rows = Math.max(...derived.bands.map((b) => b.threads.length))
  const width = PAD * 2 + (derived.bands.length - 1) * COL + W
  const height = PAD * 2 + rows * ROW

  const edges = opened.filter((e) => pos.has(e.from) && pos.has(e.to)).map((e) => {
    const a = pos.get(e.from), b = pos.get(e.to)
    const [x1, y1] = [a.x + W, a.y + H / 2]
    const [x2, y2] = [b.x, b.y + H / 2]
    const mx = (x1 + x2) / 2
    return `<path class="gedge" d="M${x1},${y1} Q${mx},${y1} ${mx},${(y1 + y2) / 2} T${x2},${y2}" `
         + `fill="none" stroke="currentColor" stroke-width="1" opacity=".45" marker-end="url(#gar)">`
         + `<title>${esc(e.label)}</title></path>`
  }).join('')

  const nodes = [...pos.entries()].map(([letter, p]) => {
    const d = derived.threads.get(letter)
    return `<g class="gnode" data-state="${attr(d.state)}">`
         + `<rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" fill="none" stroke="currentColor" `
         + `stroke-dasharray="${d.state === 'not-started' ? '3 3' : '0'}"/>`
         + `<text x="${p.x + W / 2}" y="${p.y + 17}" text-anchor="middle" font-size="12" `
         + `fill="currentColor" font-family="ui-monospace, Menlo, monospace">`
         + `${esc(letter)} ${esc(d.pips)}</text></g>`
  }).join('')

  const labels = derived.bands.map((b, col) =>
    `<text x="${PAD + col * COL}" y="14" font-size="9" fill="currentColor" opacity=".6" `
    + `font-family="ui-monospace, Menlo, monospace">${esc(b.label.toUpperCase())}</text>`).join('')

  return `<figure class="loop"><svg viewBox="0 0 ${width} ${height + 16}" role="img" `
       + `aria-label="Thread graph: which thread opened a question for which other thread.">`
       + `<defs><marker id="gar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" `
       + `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`
       + `<g style="color:var(--ink-soft)">${labels}${edges}${nodes}</g></svg>`
       + `<figcaption>An edge is a question one thread opened for another.</figcaption></figure>`
}
