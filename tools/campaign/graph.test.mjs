import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { renderGraph } from './graph.mjs'

const model = loadCampaign('tools/campaign/fixtures/mini')

test('emits one node per thread', () => {
  // The mini fixture has three threads (A/assemble, B/around, C/assemble).
  const svg = renderGraph(model)
  assert.equal([...svg.matchAll(/class="gnode"/g)].length, 3)
})

test('emits one path per drawable (thread -> thread) edge, not per derived.edges entry', () => {
  // derived.edges mixes two kinds: 'opened' (thread -> thread, drawable) and 'gates'
  // (thread -> phase, not a node on this graph). The mini fixture has one of each
  // (A -> B opened, B -> "Phase 3" gates), so derived.edges.length is 2 but only the
  // 'opened' edge is drawable. Asserting against derived.edges.length here would be
  // asserting the wrong count.
  const svg = renderGraph(model)
  const drawable = model.derived.edges.filter((e) => e.kind === 'opened').length
  assert.equal(drawable, 1)
  assert.equal([...svg.matchAll(/class="gedge"/g)].length, drawable)
})

test('nodes carry their state for styling', () => {
  assert.match(renderGraph(model), /data-state="not-started"/)
})

test('no opened questions yields no graph at all, even when a gates edge exists', () => {
  // The real campaign (campaigns/agent-harnesses) has an empty log: derived.edges holds
  // exactly one entry, a 'gates' edge, and zero 'opened' edges. A node grid with no edges
  // duplicates the coverage strip directly above it, so the honest rendering is nothing.
  // Driven by removing 'opened' edges from derived.edges (as an empty log would produce),
  // not by blanking derived.edges outright -- the gates edge must survive and still not
  // be enough to draw a graph.
  const noOpened = {
    data: model.data,
    derived: { ...model.derived, edges: model.derived.edges.filter((e) => e.kind !== 'opened') },
  }
  assert.ok(noOpened.derived.edges.some((e) => e.kind === 'gates'), 'expected the gates edge to survive')
  assert.equal(renderGraph(noOpened), '')
})

test('the svg has no external references', () => {
  assert.doesNotMatch(renderGraph(model), /<script|href="http/)
})

test('every arch leaves the axis on the side its direction implies', () => {
  // The form's whole claim: the side carries the direction, so an edge never crosses a node. In the
  // old column grid nine of the real campaign's twenty-one questions ran right-to-left through a
  // curve written for left-to-right, and doubled back through their own source node.
  const real = loadCampaign('campaigns/agent-harnesses')
  const svg = renderGraph(real)
  const order = real.derived.bands.flatMap((b) => b.letters)
  const rank = new Map(order.map((l, i) => [l, i]))
  const opened = real.derived.edges.filter((e) => e.kind === 'opened')

  const fwd = opened.filter((e) => rank.get(e.to) > rank.get(e.from)).length
  assert.equal([...svg.matchAll(/data-dir="forward"/g)].length, fwd)
  assert.equal([...svg.matchAll(/data-dir="back"/g)].length, opened.length - fwd)
  assert.ok(fwd > 0 && opened.length - fwd > 0, 'the fixture must exercise both sides')

  // An arch's control points sit above the axis for forward and below for back, which is what makes
  // the cubic unambiguous where an elliptical arc's sweep flag would not have been.
  for (const m of svg.matchAll(/data-dir="(forward|back)"[^>]*?d="M[\d.]+,([\d.]+) C[\d.]+,([\d.]+)/g)) {
    const [, dir, y, cy] = m
    if (dir === 'forward') assert.ok(+cy < +y, 'a forward arch must rise above the axis')
    else assert.ok(+cy > +y, 'a back arch must fall below the axis')
  }
})

test('an unanswered question is the only thing drawn at full strength', () => {
  const real = loadCampaign('campaigns/agent-harnesses')
  // This campaign closed every question it opened, so the honest drawing is entirely muted — and
  // the caption says nothing about open ones rather than claiming "0 still open".
  assert.equal(real.derived.frontier.length, 0)
  const svg = renderGraph(real)
  assert.doesNotMatch(svg, /data-open="yes"/)
  assert.doesNotMatch(svg, /still open/)

  // Reopen one and it must stand out, in the accent and with its own marker.
  const derived = { ...real.derived, frontier: [{ id: real.derived.edges.find((e) => e.kind === 'opened').id }] }
  const reopened = renderGraph({ data: real.data, derived })
  assert.equal([...reopened.matchAll(/data-open="yes"/g)].length, 1)
  assert.match(reopened, /data-open="yes"[^>]*stroke="var\(--specimen\)"/)
  assert.match(reopened, /1 still open/)
})

test('the figure is only as tall as its tallest arch', () => {
  // A fixed canvas would leave a campaign's worth of empty space above a short-question graph.
  const short = renderGraph(model)
  const tall = renderGraph(loadCampaign('campaigns/agent-harnesses'))
  const h = (s) => +s.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1]
  assert.ok(h(short) < h(tall), `expected the mini fixture to be shorter: ${h(short)} vs ${h(tall)}`)
})
