import { esc, attr } from './html.mjs'

// An arc diagram: every thread on one axis, every question an arch over it.
//
// This was a five-column grid — a column per loop step, a row per thread inside it — with edges
// drawn as Q/T curves between node edges. Three things were wrong with it, and they were properties
// of this campaign's data rather than of the drawing. The bands are lopsided (1 to 5 threads), so
// the grid was mostly whitespace with one crowded column. Nine of the twenty-one questions run
// right-to-left in band order, and the curve was written assuming left-to-right, so those nine
// doubled back through their own source node. And the mean question spans 3.8 columns, so almost
// every edge crossed the nodes between its ends.
//
// One axis fixes all three. Arcs leave the axis, so an edge can never cross a node; the side carries
// the direction, so the backward nine read as a deliberate second row rather than as tangle; and the
// order is the same left-to-right order as the coverage strip directly above it, so the two figures
// are one continuous idea rather than two layouts of the same fifteen letters.
//
// Arch height rises with span, which makes long questions nest over short ones instead of
// overprinting them — the useful accident of the form, and the reason it is worth the geometry.

const R = 12          // node radius
const S = 44          // spacing between nodes on the axis
const PAD = 24
const LANE = 16       // reserved at the top for band labels
const APEX = 0.75     // where a cubic with control points at ±h actually peaks

/** Taller for a longer question, so nothing overprints and the long ones read as the long ones. */
const archOf = (span) => 18 + span * 7

/**
 * A cubic arch between two points on the axis. Written as an explicit Bézier rather than an
 * elliptical `A` command because the sweep flag's direction depends on reading order *and* on SVG's
 * downward y-axis — two chances to draw a perfect arc the wrong way round. Control points at ±h say
 * which way is up with no ambiguity at all.
 */
const arch = (x1, x2, y, h, up) => {
  const c = up ? y - h : y + h
  return `M${x1},${y} C${x1},${c} ${x2},${c} ${x2},${y}`
}

export function renderGraph({ derived }) {
  // derived.edges mixes thread -> thread ('opened', from a logged question) and thread -> phase
  // ('gates'). Only 'opened' edges connect two nodes on this graph; gate relationships are already
  // drawn on the roadmap's dependency map, so duplicating them here as dangling half-edges would add
  // noise, not information. Filter to the kind explicitly, rather than leaning on a later lookup to
  // silently drop the gates edges.
  const opened = derived.edges.filter((e) => e.kind === 'opened')
  if (opened.length === 0) return ''

  // One axis, in the same order as the coverage strip and §4 — derived.bands is the one ordering.
  const order = derived.bands.flatMap((b) => b.letters)
  const at = new Map(order.map((l, i) => [l, PAD + i * S]))

  const drawable = opened.filter((e) => at.has(e.from) && at.has(e.to))
  const rank = new Map(order.map((l, i) => [l, i]))

  // A question nobody has answered yet is the one thing on this page worth acting on, so it is the
  // one thing drawn at full strength. With an empty frontier every arch is muted, which is itself
  // the honest reading: the graph shows a closed campaign rather than looking identical to an open
  // one.
  const standing = new Set(derived.frontier.map((q) => q.id))

  const arcs = drawable.map((e) => {
    const up = rank.get(e.to) > rank.get(e.from)      // a question asked forward along the loop
    const span = Math.abs(rank.get(e.to) - rank.get(e.from))
    return { ...e, up, span, open: standing.has(e.id), h: archOf(span), x1: at.get(e.from), x2: at.get(e.to) }
  })

  // The figure is exactly as tall as its tallest arch in each direction — no fixed canvas with a
  // campaign's worth of empty space above it.
  const reach = (up) => {
    const hs = arcs.filter((a) => a.up === up).map((a) => a.h)
    return hs.length ? Math.ceil(Math.max(...hs) * APEX) : 0
  }
  const axisY = LANE + reach(true) + R + 4
  const width = PAD * 2 + (order.length - 1) * S
  const height = axisY + R + reach(false) + 14

  // One axis holding the row together, and a divider where one band ends and the next begins. This
  // was five separate rules, one under each band, on the theory that a gap says "group" — it does
  // not: at any opacity faint enough not to compete with the arcs, five rules and four gaps read as
  // one continuous line, and the rules had to overhang the end nodes to make the gaps wide enough,
  // which left stubs poking out past A and N. Two marks at two weights say it plainly instead, and a
  // one-thread band (CALL) still gets a boundary, which a zero-length rule could never have drawn.
  const ends = [at.get(order[0]), at.get(order.at(-1))]
  const axis = `<line x1="${ends[0]}" y1="${axisY}" x2="${ends[1]}" y2="${axisY}" `
             + `stroke="currentColor" stroke-width="1" opacity=".15"/>`

  const filled = derived.bands.filter((b) => b.letters.length)
  const dividers = filled.slice(1).map((b) => {
    const first = Math.min(...b.letters.map((l) => at.get(l)))
    return `<line x1="${first - S / 2}" y1="${axisY - R - 7}" x2="${first - S / 2}" y2="${axisY + R + 7}" `
         + `stroke="currentColor" stroke-width="1" opacity=".28"/>`
  }).join('')
  const baselines = axis + dividers

  const labels = derived.bands.filter((b) => b.letters.length).map((b) => {
    const xs = b.letters.map((l) => at.get(l))
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2
    return `<text x="${mid}" y="11" text-anchor="middle" font-size="9" fill="currentColor" `
         + `opacity=".55" font-family="ui-monospace, Menlo, monospace" letter-spacing=".08em">`
         + `${esc(b.label.toUpperCase())}</text>`
  }).join('')

  // Arcs start and end at the circle's rim rather than its centre, so the arrowhead lands on the
  // node it points at instead of underneath it.
  const edges = arcs.map((a) => {
    const y = a.up ? axisY - R : axisY + R
    const ink = a.open ? ' stroke="var(--specimen)" stroke-width="1.6" opacity="1"'
                       : ' stroke="currentColor" stroke-width="1" opacity=".42"'
    return `<path class="gedge" data-dir="${a.up ? 'forward' : 'back'}" data-open="${a.open ? 'yes' : 'no'}" `
         + `d="${arch(a.x1, a.x2, y, a.h, a.up)}" fill="none"${ink} `
         + `marker-end="url(#${a.open ? 'gar-open' : 'gar'})">`
         + `<title>${esc(a.from)} → ${esc(a.to)}: ${esc(a.label)}`
         + `${a.open ? ' (open)' : ''}</title></path>`
  }).join('')

  // Drawn last so the circles sit over the arc ends. A dry thread is filled — it is the state that
  // stops work, so it should be the one that reads as solid.
  const nodes = order.map((letter) => {
    const d = derived.threads.get(letter)
    const x = at.get(letter)
    const dash = d.state === 'not-started' ? ' stroke-dasharray="3 3"' : ''
    const fill = d.state === 'dry' ? 'var(--sunk)' : 'var(--raised)'
    return `<g class="gnode" data-state="${attr(d.state)}">`
         + `<circle cx="${x}" cy="${axisY}" r="${R}" fill="${fill}" stroke="currentColor"${dash}/>`
         + `<text x="${x}" y="${axisY + 4}" text-anchor="middle" font-size="11" fill="currentColor" `
         + `font-family="ui-monospace, Menlo, monospace">${esc(letter)}</text>`
         + `<title>${esc(letter)} · ${esc(d.name)} — ${esc(d.state)}</title></g>`
  }).join('')

  const up = arcs.filter((a) => a.up).length
  const open = arcs.filter((a) => a.open).length
  // Said only when it is true. "0 still open" is a sentence about nothing; an empty frontier is
  // already stated in words directly above this figure.
  const openNote = open === 0 ? ''
    : ` <b>${open} still open</b>, drawn in full colour — those are the ones with work behind them.`

  return `<figure class="loop"><svg viewBox="0 0 ${width} ${height}" role="img" `
       + `aria-label="Arc diagram of ${order.length} threads on one axis. Each arch is a question one `
       + `thread opened for another: ${up} arching above, asked forward along the loop, and `
       + `${arcs.length - up} below, asked back to an earlier step.">`
       + `<defs><marker id="gar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" `
       + `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity=".8"/>`
       + `</marker>`
       + `<marker id="gar-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" `
       + `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--specimen)"/></marker></defs>`
       + `<g style="color:var(--ink-soft)">${labels}${baselines}${edges}${nodes}</g></svg>`
       + `<figcaption>Each arch is a question one thread opened for another — `
       + `<b>${up} above</b>, asked forward along the loop, and <b>${arcs.length - up} below</b>, `
       + `asked back to an earlier step. Taller means further. Hover an arch for the question.`
       + `${openNote}</figcaption></figure>`
}
