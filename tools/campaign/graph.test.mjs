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
