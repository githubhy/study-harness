import { esc, attr } from './html.mjs'
import { layout, pathOf } from './graph-layout.mjs'
import { arcMark, markersFor } from './graph.mjs'

// The rail's vertical spine: the coverage strip, the thread graph and the table of contents as one
// object.
//
// Those were three separate presentations of the same fifteen threads — pips in a strip, circles in
// a graph, links in an index — each saying something the other two nearly said. Turned on its side
// and given the threads' names, one figure does all three jobs and fits a narrow column, and being
// sticky it stays available while the findings scroll past it.
//
// What it gives up, deliberately: side-encodes-direction. A rail has no margin to bow into on both
// sides, so every arch here bows outward and the arrowhead carries direction alone. The horizontal
// figure keeps that property and stays on the page at the foot.
//
// What it cannot have: a "you are here" that follows the scroll. checkHtml rejects `<script>`
// anywhere on the page, and scroll-driven CSS is not in Firefox, so position is shown by `:target`
// — it lights up the thread you clicked, and nothing pretends to more than that.

export function renderSpine({ derived }) {
  const l = layout(derived, { orientation: 'vertical' })
  if (!l) return ''

  // Drawn after the arcs and knocked out of them: a label sits at the left edge, which is exactly
  // where the gutter's arcs are, so without this the deepest arches run straight through the word.
  // `paint-order="stroke"` puts the page-coloured stroke behind the glyph rather than over it.
  const labels = l.groups.map((g) =>
    `<text x="${g.x}" y="${g.y}" text-anchor="${attr(g.anchor)}" font-size="9" fill="currentColor" `
    + `opacity=".75" font-family="ui-monospace, Menlo, monospace" letter-spacing=".1em" `
    + `stroke="var(--paper)" stroke-width="3.5" paint-order="stroke">`
    + `${esc(g.label.toUpperCase())}</text>`).join('')

  // No dividers here, though the layout offers them. In the rail a band's label already sits in the
  // gap it opens above its own first node, so the rule is a second mark saying the same thing — and
  // it crosses the label, which is how it was noticed.

  const axis = `<line x1="${l.axis.x1}" y1="${l.axis.y1}" x2="${l.axis.x2}" y2="${l.axis.y2}" `
             + `stroke="currentColor" stroke-width="1" opacity=".15"/>`

  const edges = l.arcs.map((a) => arcMark(a, { cls: 'sedge', marker: 'sar' })).join('')

  // The node carries its letter and its pips ride alongside — that is the coverage strip's whole job,
  // folded in. The full name stays in the title and the link's label rather than on the figure: at
  // rail width there is no honest way to fit "Inputs & code intelligence" beside a circle, and a
  // truncated name is worse than none.
  const nodes = l.nodes.map((n) => {
    const dash = n.state === 'not-started' ? ' stroke-dasharray="3 3"' : ''
    const fill = n.state === 'dry' ? 'var(--sunk)' : 'var(--raised)'
    const label = `${n.letter} · ${n.name} — ${n.state}, ${n.findings} finding`
                + `${n.findings === 1 ? '' : 's'}. Go to its findings.`
    return `<a href="${attr(n.href)}" aria-label="${attr(label)}">`
         + `<g class="snode" data-state="${attr(n.state)}">`
         + `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${fill}" stroke="currentColor"${dash}/>`
         + `<text x="${n.x}" y="${n.y + 3.5}" text-anchor="middle" font-size="9.5" fill="currentColor" `
         + `font-family="ui-monospace, Menlo, monospace" pointer-events="none">${esc(n.letter)}</text>`
         + `<text x="${n.x + n.r + 5}" y="${n.y + 3.5}" font-size="9" fill="currentColor" opacity=".65" `
         + `font-family="ui-monospace, Menlo, monospace" pointer-events="none">${esc(n.pips)}</text>`
         + `<title>${esc(n.letter)} · ${esc(n.name)} — ${esc(n.pips)}</title></g></a>`
  }).join('')

  const open = l.arcs.filter((a) => a.open).length
  return `<figure class="spine"><svg viewBox="0 0 ${l.viewBox.w} ${l.viewBox.h}" role="img" `
       + `aria-label="The campaign's ${l.nodes.length} threads down the loop's five steps, with `
       + `${l.arcs.length} question${l.arcs.length === 1 ? '' : 's'} joining them.">`
       + `<defs>${markersFor('sar')}</defs>`
       + `<g style="color:var(--ink-soft)">${axis}${edges}${labels}${nodes}</g></svg>`
       + `<figcaption>${l.nodes.length} threads · ${l.arcs.length} questions`
       + `${open ? ` · <b>${open} open</b>` : ''}</figcaption></figure>`
}

/** The reports, in reading order — the rail's other half, and the campaign's front door. */
export function renderReports({ derived }) {
  const { reports } = derived.noteIndex
  if (!reports.length) return ''
  return '<nav class="rail-reports" aria-label="Reports"><h2>Reports</h2><ol>'
    + reports.map((r) => `<li><a href="${attr(r.href)}">${esc(r.label)}</a></li>`).join('')
    + '</ol></nav>'
}

// Also rendered when empty: this is the campaign's frontier, and "no open questions" is a fact about
// a finished study rather than an absence to hide. The page was designed to stay honest in both
// states, and this is where that shows.
export function renderFrontier({ derived }) {
  const { frontier } = derived
  const body = frontier.length === 0
    ? '<p class="quiet">No open questions. The next thread is a fresh pick.</p>'
    : `<ul>${frontier.map((q) =>
        `<li><a href="#t${attr(q.ask)}">${esc(q.q)}</a> <span class="mono">${esc(q.from)} → ${esc(q.ask)}</span></li>`
      ).join('')}</ul>`
  return `<nav class="rail-open" aria-label="Open questions"><h2>Open questions</h2>${body}</nav>`
}
