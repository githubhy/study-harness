import { esc, attr } from './html.mjs'
import { layout, pathOf } from './graph-layout.mjs'

// The horizontal thread graph: every thread on one axis, every question an arch over it.
//
// All geometry now comes from graph-layout.mjs. This file decides what the marks look like and what
// they link to, and computes no coordinate — which is what let the invariants that matter (no arc
// crosses a node, every arc ends on a rim) move out of regexes over path data and into assertions on
// numbers, checked for both this form and the rail's.
//
// The distinctive property kept here and unavailable in the rail: **side encodes direction**. A
// question asked forward along the loop arches above the axis, one asked back to an earlier step
// arches below. The rail has no margin to bow into on both sides, so it carries direction on the
// arrowhead alone and this figure remains the one that shows the split at a glance.

/**
 * Arrowheads, under a caller-supplied id prefix.
 *
 * Both figures are in the DOM at once — a media query decides which is shown, not which is built —
 * so a single hardcoded `gar` would be a duplicate id, and the property check rejects those for
 * exactly this reason: every `url(#…)` on the page would then resolve to whichever came first.
 */
export const markersFor = (p) => ''
  + `<marker id="${attr(p)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" `
  + `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity=".8"/></marker>`
  + `<marker id="${attr(p)}-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" `
  + `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--specimen)"/></marker>`

/**
 * An arch, as a link.
 *
 * A question's whole point is its answer, so an answered arch goes to the finding that closed it and
 * a standing one to the thread that owes it — both decided by the layout, which owns that rule for
 * every form of the figure. The hit path is why it is usable: a 1px stroke is not a click target, so
 * an invisible 14px copy of the same curve takes the pointer. `pointer-events="stroke"` asks for the
 * stroke *geometry* rather than its paint, so the width counts even though nothing is drawn.
 */
export const arcMark = (a, { cls = 'gedge', marker = 'gar' } = {}) => {
  const d = pathOf(a)
  const ink = a.open ? ' stroke="var(--specimen)" stroke-width="1.6" opacity="1"'
                     : ' stroke="currentColor" stroke-width="1" opacity=".42"'
  const where = a.answered ? 'read the finding that answered it' : `see ${a.to}, which owes the answer`
  const label = `${a.from} asked ${a.to}: ${a.label}${a.open ? ' — still open' : ''}. Go to ${where}.`
  return `<a href="${attr(a.href)}" aria-label="${attr(label)}">`
       + `<path class="${cls}-hit" d="${d}" fill="none" stroke="transparent" stroke-width="14" `
       + `pointer-events="stroke"/>`
       + `<path class="${cls}" data-dir="${attr(a.dir)}" data-open="${a.open ? 'yes' : 'no'}" `
       + `d="${d}" fill="none"${ink} pointer-events="none" `
       + `marker-end="url(#${marker}${a.open ? '-open' : ''})"/>`
       + `<title>${esc(a.from)} → ${esc(a.to)}: ${esc(a.label)}${a.open ? ' (open)' : ''}</title></a>`
}

export function renderGraph({ derived }) {
  // Only 'opened' edges join two nodes here; 'gates' edges point at a phase, which is already drawn
  // on the roadmap's dependency map, so duplicating them as dangling half-edges would add noise.
  // With none of them there is nothing to draw but a row of circles the coverage strip already shows.
  if (derived.edges.filter((e) => e.kind === 'opened').length === 0) return ''
  const l = layout(derived, { orientation: 'horizontal' })
  if (!l) return ''

  const rule = (o) => (d) => `<line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" `
                           + `stroke="currentColor" stroke-width="1" opacity="${o}"/>`
  const axis = rule('.15')(l.axis)
  const dividers = l.dividers.map(rule('.28')).join('')

  const labels = l.groups.map((g) =>
    `<text x="${g.x}" y="${g.y}" text-anchor="${attr(g.anchor)}" font-size="9" fill="currentColor" `
    + `opacity=".55" font-family="ui-monospace, Menlo, monospace" letter-spacing=".08em">`
    + `${esc(g.label.toUpperCase())}</text>`).join('')

  const edges = l.arcs.map((a) => arcMark(a)).join('')

  // Drawn last so the circles sit over the arc ends. A dry thread is filled: it is the state that
  // stops work, so it is the one that should read as solid.
  const nodes = l.nodes.map((n) => {
    const dash = n.state === 'not-started' ? ' stroke-dasharray="3 3"' : ''
    const fill = n.state === 'dry' ? 'var(--sunk)' : 'var(--raised)'
    const label = `${n.letter} · ${n.name} — ${n.state}, ${n.findings} finding`
                + `${n.findings === 1 ? '' : 's'}. Go to its findings.`
    return `<a href="${attr(n.href)}" aria-label="${attr(label)}">`
         + `<g class="gnode" data-state="${attr(n.state)}">`
         + `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${fill}" stroke="currentColor"${dash}/>`
         + `<text x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-size="11" fill="currentColor" `
         + `font-family="ui-monospace, Menlo, monospace" pointer-events="none">${esc(n.letter)}</text>`
         + `<title>${esc(n.letter)} · ${esc(n.name)} — ${esc(n.state)}</title></g></a>`
  }).join('')

  const up = l.arcs.filter((a) => a.dir === 'forward').length
  const open = l.arcs.filter((a) => a.open).length
  // Said only when it is true. "0 still open" is a sentence about nothing, and an empty frontier is
  // already stated in words elsewhere on the page.
  const openNote = open === 0 ? ''
    : ` <b>${open} still open</b>, drawn in full colour — those are the ones with work behind them.`

  return `<figure class="loop"><svg viewBox="0 0 ${l.viewBox.w} ${l.viewBox.h}" role="img" `
       + `aria-label="Arc diagram of ${l.nodes.length} threads on one axis. Each arch is a question `
       + `one thread opened for another: ${up} arching above, asked forward along the loop, and `
       + `${l.arcs.length - up} below, asked back to an earlier step.">`
       + `<defs>${markersFor('gar')}</defs>`
       + `<g style="color:var(--ink-soft)">${labels}${axis}${dividers}${edges}${nodes}</g></svg>`
       + `<figcaption>Each arch is a question one thread opened for another — `
       + `<b>${up} above</b>, asked forward along the loop, and <b>${l.arcs.length - up} below</b>, `
       + `asked back to an earlier step. Deeper means further apart on this axis. `
       + `Click an arch for the finding that answered it.${openNote}</figcaption></figure>`
}
