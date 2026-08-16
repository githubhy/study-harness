// Where the thread graph's geometry lives — for both of its forms, and as data rather than markup.
//
// The horizontal figure used to compute its own coordinates inline, which meant its central claim
// could only be tested by regex over path data: `d="M12,34 C..."` scraped for a y-value. That reaches
// the invariants you can write as a pattern and no others, and the most important one — that an arc
// never passes through a node, which is the entire reason for the arc form — could not be written as
// a pattern at all.
//
// So this module returns numbers. Both renderers consume them and neither computes a coordinate, so
// the invariants are asserted once, on real values, for every orientation and every shape of campaign
// the property tests can invent.

const METRICS = {
  // Left to right, arches above and below, band labels in a lane across the top.
  horizontal: { r: 12, gap: 44, pad: 24, lane: 16, bandGap: 0, per: 22, base: 14, tail: 14 },
  // Top to bottom in a narrow rail. Arches bow *left* into a gutter and the nodes sit to the right
  // of it, so the figure reads as a list with a margin of connections rather than as a graph with
  // labels stuck to it. `lane` is headroom for the first band's label, which otherwise renders at a
  // negative y and vanishes; `trail` is the room to the right of a node for its pips.
  vertical: { r: 9, gap: 26, pad: 6, lane: 18, bandGap: 22, per: 9, base: 10, tail: 6, trail: 24 },
}

/** Where a cubic with control points at ±h actually peaks — not h, which is a common off-by-a-quarter. */
const APEX = 0.75

/**
 * Taller for a longer question, on a compressive scale.
 *
 * This was linear, and the caption claimed "taller means further". Both were overclaims: the axis is
 * band order, and *within* a band the order is alphabetical, so span is a distance in a partly
 * arbitrary list. Linear growth also let a single span-9 arch set the frame and leave the left third
 * of the figure empty. A square root keeps the ordering — longer still reads as taller — while
 * flattening the top, so the deepest arch sits nearer the median and the frame fits the content.
 */
const archOf = (span, m) => m.base + m.per * Math.sqrt(span)

/**
 * Concrete coordinates for one orientation.
 *
 * `orientation` picks which way the row of nodes runs: 'horizontal' lays them left to right with
 * arches above and below, 'vertical' lays them top to bottom with every arch bowing the same way.
 * The vertical form cannot use side-for-direction — a rail has no margin to bow into on both sides —
 * so it carries direction on the arrowhead alone. That is a real loss, and the reason the horizontal
 * figure is kept rather than replaced.
 */
export function layout(derived, { orientation = 'horizontal', metrics } = {}) {
  if (!METRICS[orientation]) throw new Error(`unknown orientation ${JSON.stringify(orientation)}`)
  const m = { ...METRICS[orientation], ...metrics }
  const vertical = orientation === 'vertical'

  const filled = derived.bands.filter((b) => b.letters.length)
  const order = filled.flatMap((b) => b.letters)
  if (order.length === 0) return null
  const rank = new Map(order.map((l, i) => [l, i]))

  // Which band each node belongs to, so a band break can open real space rather than rely on a
  // divider alone. Horizontal keeps bandGap at 0 and uses only the divider; the rail needs the gap
  // because a band's label lives in it.
  const bandOf = new Map()
  filled.forEach((b, bi) => b.letters.forEach((l) => bandOf.set(l, bi)))

  // Positions along the axis, computed once. Everything else reads this array, so the two forms
  // cannot drift apart on where a node actually is.
  const along = order.map((l, i) => m.pad + i * m.gap + bandOf.get(l) * m.bandGap)
  const span0 = along.at(-1)

  const opened = derived.edges.filter((e) => e.kind === 'opened')
  const drawable = opened.filter((e) => rank.has(e.from) && rank.has(e.to))
  const standing = new Set(derived.frontier.map((q) => q.id))

  const shaped = drawable.map((e) => {
    const span = Math.abs(rank.get(e.to) - rank.get(e.from))
    // 'forward' is toward a later step of the loop. In the horizontal form it decides which side the
    // arch bows to; in the vertical form it decides only the wording of the label.
    const dir = rank.get(e.to) > rank.get(e.from) ? 'forward' : 'back'
    return { ...e, span, dir, h: archOf(span, m), open: standing.has(e.id) }
  })

  // The frame is exactly as deep as its deepest arch on each side — a fixed canvas would leave a
  // campaign's worth of dead space above a graph whose questions all happen to be short.
  const reachOf = (side) => {
    const hs = shaped.filter((a) => side === 'any' || a.dir === side).map((a) => a.h)
    return hs.length ? Math.ceil(Math.max(...hs) * APEX) : 0
  }
  const near = vertical ? reachOf('any') : reachOf('forward')  // bows left in the rail, up in the figure
  const far = vertical ? 0 : reachOf('back')                   // bows down in the figure only

  // How far in from the edge the row of nodes sits, leaving room for whatever bows away from it.
  // Sized from the deepest arch rather than fixed, so the gutter is exactly as wide as it needs to
  // be and a campaign whose questions are all short does not get a column of empty margin.
  const cross = vertical ? m.pad + near + m.r : m.lane + near + m.r + 4

  const at = (i) => {
    // Fractional indices are legal: a band's label sits at the midpoint of its first and last node.
    const d = Number.isInteger(i) ? along[i] : (along[Math.floor(i)] + along[Math.ceil(i)]) / 2
    return vertical ? { x: cross, y: m.lane + d } : { x: d, y: cross }
  }

  // The axis end needs the last node's radius as well as the padding. Without the radius the frame
  // stopped at the node's centre whenever pad was smaller than r, and the bottom of the last circle
  // was clipped — which the property check caught and no amount of looking at the middle of the
  // figure would have.
  const viewBox = vertical
    ? { w: cross + m.r + m.trail + m.tail, h: m.lane + span0 + m.r + m.pad }
    : { w: span0 + m.r + m.pad, h: cross + m.r + far + m.tail }

  const nodes = order.map((letter, i) => {
    const t = derived.threads.get(letter)
    const p = at(i)
    return { letter, name: t.name, state: t.state, pips: t.pips, findings: t.entries.length,
             x: p.x, y: p.y, r: m.r, href: `#t${letter}` }
  })

  // Arcs leave from the rim rather than the centre, so an arrowhead lands on the node it points at
  // instead of underneath it.
  const arcs = shaped.map((a) => {
    const s = at(rank.get(a.from))
    const t = at(rank.get(a.to))
    const answer = derived.answeredBy?.get(a.id)
    const common = { id: a.id, from: a.from, to: a.to, dir: a.dir, span: a.span, open: a.open,
                     label: a.label, href: answer ? `#${answer}` : `#t${a.to}`,
                     answered: Boolean(answer) }
    if (vertical) {
      const x = s.x - m.r                     // every arch leaves the left rim and bows into the gutter
      return { ...common, x1: x, y1: s.y, x2: x, y2: t.y,
               c1x: x - a.h, c1y: s.y, c2x: x - a.h, c2y: t.y }
    }
    const up = a.dir === 'forward'
    const y = up ? s.y - m.r : s.y + m.r
    const c = up ? y - a.h : y + a.h
    return { ...common, x1: s.x, y1: y, x2: t.x, y2: y, c1x: s.x, c1y: c, c2x: t.x, c2y: c }
  })

  const groups = filled.map((b) => {
    const ix = b.letters.map((l) => rank.get(l))
    const lo = Math.min(...ix), hi = Math.max(...ix)
    const first = at(lo)
    const mid = at((lo + hi) / 2)
    // In the rail the label sits in the gap opened above its first node and starts at the frame's
    // left edge, so it may use the gutter's full width rather than being clipped by it. In the
    // horizontal figure it sits in the lane across the top, centred over the band's run.
    return { id: b.id, label: b.label, letters: b.letters, from: lo, to: hi,
             x: vertical ? 0 : mid.x,
             y: vertical ? first.y - m.r - 7 : 11,
             anchor: vertical ? 'start' : 'middle' }
  })

  // A boundary where one band ends and the next begins. Five separate rules under five bands read as
  // one continuous line at any weight faint enough not to compete with the arcs, so it is one axis
  // plus dividers instead — and a one-thread band still gets a boundary, which a zero-length rule
  // could never have drawn.
  const dividers = filled.slice(1).map((b) => {
    const i = Math.min(...b.letters.map((l) => rank.get(l)))
    const p = at(i)
    const back = (m.gap + m.bandGap) / 2
    return vertical
      ? { x1: p.x - m.r - 6, y1: p.y - back, x2: p.x + m.r + 6, y2: p.y - back }
      : { x1: p.x - back, y1: p.y - m.r - 7, x2: p.x - back, y2: p.y + m.r + 7 }
  })

  const a0 = at(0), a1 = at(order.length - 1)
  return { orientation, viewBox, axis: { x1: a0.x, y1: a0.y, x2: a1.x, y2: a1.y },
           dividers, groups, nodes, arcs, metrics: m }
}

/** The cubic itself, so neither renderer writes path syntax by hand. */
export const pathOf = (a) => `M${a.x1},${a.y1} C${a.c1x},${a.c1y} ${a.c2x},${a.c2y} ${a.x2},${a.y2}`

/**
 * A point on a cubic at t, used by the tests to assert that no arc passes through a node — the claim
 * the whole arc form rests on, and one that could not be checked while the geometry was a string.
 */
export function pointAt(a, t) {
  const u = 1 - t
  const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
  return {
    x: b[0] * a.x1 + b[1] * a.c1x + b[2] * a.c2x + b[3] * a.x2,
    y: b[0] * a.y1 + b[1] * a.c1y + b[2] * a.c2y + b[3] * a.y2,
  }
}
