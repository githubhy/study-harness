import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { layout, pointAt } from './graph-layout.mjs'

const REAL = loadCampaign('campaigns/agent-harnesses').derived
const MINI = loadCampaign('tools/campaign/fixtures/mini').derived
const BOTH = ['horizontal', 'vertical']

/**
 * Synthetic campaigns, so the shapes that broke the last redesign are exercised on purpose rather
 * than found by rendering a PNG and squinting. The one-thread band and the edgeless thread were both
 * discovered that way; here they are inputs.
 */
const synth = ({ bands, edges = [] }) => {
  const letters = bands.flat()
  return {
    bands: bands.map((ls, i) => ({ id: `b${i}`, label: `Band ${i}`, letters: ls })),
    threads: new Map(letters.map((l) => [l, { letter: l, name: `Thread ${l}`, state: 'live',
                                              pips: '○○', entries: [{}] }])),
    edges: edges.map(([from, to], i) => ({ from, to, kind: 'opened', id: `q${i}`, label: `q${i}` })),
    frontier: [],
    answeredBy: new Map(),
  }
}

const CASES = {
  real: REAL,
  mini: MINI,
  'one thread': synth({ bands: [['A']] }),
  'one band, no edges': synth({ bands: [['A', 'B', 'C']] }),
  'a band of one': synth({ bands: [['A', 'B'], ['C'], ['D', 'E']], edges: [['A', 'D'], ['E', 'B']] }),
  'an edgeless thread': synth({ bands: [['A', 'B', 'C']], edges: [['A', 'B']] }),
  'every pair joined': synth({ bands: [['A', 'B'], ['C', 'D']],
    edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'], ['A', 'C'], ['B', 'D']] }),
  'forty threads': synth({
    bands: [[...'ABCDEFGHIJ'], [...'KLMNOPQRST'], [...'UVWXYZabcd'], [...'efghijklmn']],
    edges: [['A', 'n'], ['n', 'A'], ['e', 'K'], ['B', 'C']],
  }),
}

for (const orientation of BOTH) {
  for (const [name, derived] of Object.entries(CASES)) {
    const l = layout(derived, { orientation })

    test(`${orientation} · ${name} · every node is inside the frame`, () => {
      for (const n of l.nodes) {
        assert.ok(n.x - n.r >= 0 && n.x + n.r <= l.viewBox.w, `${n.letter} escapes horizontally`)
        assert.ok(n.y - n.r >= 0 && n.y + n.r <= l.viewBox.h, `${n.letter} escapes vertically`)
      }
    })

    test(`${orientation} · ${name} · no two nodes overlap`, () => {
      for (let i = 0; i < l.nodes.length; i++) {
        for (let j = i + 1; j < l.nodes.length; j++) {
          const a = l.nodes[i], b = l.nodes[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          assert.ok(d >= a.r + b.r, `${a.letter} and ${b.letter} overlap (${d.toFixed(1)}px apart)`)
        }
      }
    })

    test(`${orientation} · ${name} · no arc passes through a node`, () => {
      // The entire claim of the arc form, and untestable while the geometry was a path string. An
      // arc legitimately touches the rim of its own two endpoints, so those are exempt; anything
      // else it crosses is the tangle this layout exists to prevent.
      for (const a of l.arcs) {
        for (let s = 1; s < 40; s++) {
          const p = pointAt(a, s / 40)
          for (const n of l.nodes) {
            if (n.letter === a.from || n.letter === a.to) continue
            const d = Math.hypot(p.x - n.x, p.y - n.y)
            assert.ok(d >= n.r, `${a.from}→${a.to} crosses ${n.letter} at t=${(s / 40).toFixed(2)}`)
          }
        }
      }
    })

    test(`${orientation} · ${name} · every arc stays inside the frame`, () => {
      // Sampled, not checked at the control points: a cubic's control point sits at the full arch
      // height while the curve only reaches three quarters of it, so asserting on control points
      // would demand a frame a third larger than the drawing needs. What must not be clipped is the
      // ink.
      for (const a of l.arcs) {
        for (let s = 0; s <= 40; s++) {
          const p = pointAt(a, s / 40)
          assert.ok(p.x >= 0 && p.x <= l.viewBox.w, `${a.from}→${a.to} leaves the frame at x=${p.x.toFixed(1)}`)
          assert.ok(p.y >= 0 && p.y <= l.viewBox.h, `${a.from}→${a.to} leaves the frame at y=${p.y.toFixed(1)}`)
        }
      }
    })

    test(`${orientation} · ${name} · every arc starts and ends on a rim, not a centre`, () => {
      const by = new Map(l.nodes.map((n) => [n.letter, n]))
      for (const a of l.arcs) {
        const s = by.get(a.from), t = by.get(a.to)
        assert.ok(Math.abs(Math.hypot(a.x1 - s.x, a.y1 - s.y) - s.r) < 0.01, `${a.from} end off-rim`)
        assert.ok(Math.abs(Math.hypot(a.x2 - t.x, a.y2 - t.y) - t.r) < 0.01, `${a.to} end off-rim`)
      }
    })

    test(`${orientation} · ${name} · node order is derive's band order`, () => {
      assert.deepEqual(l.nodes.map((n) => n.letter), derived.bands.flatMap((b) => b.letters))
    })

    test(`${orientation} · ${name} · the frame fits its content and no more`, () => {
      // A fixed canvas would leave dead space above a graph whose questions all happen to be short.
      const xs = [...l.arcs.flatMap((a) => [a.x1, a.x2]), ...l.nodes.map((n) => n.x + n.r)]
      const ys = [...l.arcs.flatMap((a) => [a.y1, a.y2]), ...l.nodes.map((n) => n.y + n.r)]
      assert.ok(Math.max(...xs) <= l.viewBox.w && Math.max(...ys) <= l.viewBox.h)
      assert.ok(l.viewBox.w > 0 && l.viewBox.h > 0)
    })
  }
}

test('the horizontal form encodes direction by side; the vertical form cannot', () => {
  const h = layout(REAL, { orientation: 'horizontal' })
  for (const a of h.arcs) {
    if (a.dir === 'forward') assert.ok(a.c1y < a.y1, 'a forward arch must rise')
    else assert.ok(a.c1y > a.y1, 'a back arch must fall')
  }
  // The rail has no margin to bow into on both sides, so every arch goes the same way — into the
  // gutter on the left, leaving the nodes and their pips clear on the right — and the arrowhead
  // carries direction alone. Asserted so the loss stays deliberate.
  const v = layout(REAL, { orientation: 'vertical' })
  assert.ok(v.arcs.every((a) => a.c1x < a.x1), 'every rail arch bows into the gutter')
  assert.ok(v.arcs.some((a) => a.dir === 'forward') && v.arcs.some((a) => a.dir === 'back'))
})

test('a longer question arches deeper, on a compressive scale', () => {
  const l = layout(REAL, { orientation: 'horizontal' })
  const depth = (a) => Math.abs(a.c1y - a.y1)
  const bySpan = [...l.arcs].sort((a, b) => a.span - b.span)
  assert.ok(depth(bySpan[0]) < depth(bySpan.at(-1)), 'longer must read as deeper')
  // Compressive, not linear: the deepest arch must not tower over the median, which is what left the
  // left third of the previous figure empty.
  const mid = bySpan[Math.floor(bySpan.length / 2)]
  assert.ok(depth(bySpan.at(-1)) < depth(mid) * 2, 'the deepest arch must stay near the median')
})

test('every arc carries a link target, to the answer where there is one', () => {
  const l = layout(REAL, { orientation: 'horizontal' })
  assert.ok(l.arcs.length > 0)
  for (const a of l.arcs) {
    assert.match(a.href, /^#/)
    assert.ok(a.id, 'an arc must carry the question it draws')
    assert.equal(a.answered, REAL.answeredBy.has(a.id), 'answered must follow answeredBy')
    // Answered goes to the finding that closed it; standing goes to the thread that owes it.
    assert.equal(a.href, a.answered ? `#${REAL.answeredBy.get(a.id)}` : `#t${a.to}`)
  }
})

test('an unknown orientation fails loudly rather than laying out sideways', () => {
  assert.throws(() => layout(REAL, { orientation: 'diagonal' }), /unknown orientation "diagonal"/)
})

test('a campaign with no threads lays out to nothing rather than to NaN', () => {
  // Every metric below is derived from the node positions, so an empty order would produce a frame
  // of NaN and an SVG that renders as a blank box rather than as nothing.
  for (const orientation of BOTH)
    assert.equal(layout({ ...MINI, bands: [] }, { orientation }), null)
})
