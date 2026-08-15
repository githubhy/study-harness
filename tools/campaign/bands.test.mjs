import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { renderRoadmap } from './render-roadmap.mjs'
import { renderWorklog } from './render-worklog.mjs'
import { renderGraph } from './graph.mjs'

const MINI = 'tools/campaign/fixtures/mini'

// Band grouping and within-band order were implemented three times — the roadmap sorted with
// `<`/`>`, the worklog strip and the graph with localeCompare — and agreed only because thread
// letters happen to be single uppercase characters. derive() computes the order once; these tests
// check that all three renderers consume it rather than re-deriving something that matches.

test('derive computes the bands in loopSteps order, alphabetical within', () => {
  const { derived } = loadCampaign(MINI)
  assert.deepEqual(
    derived.bands.map((b) => [b.id, b.letters]),
    [['assemble', ['A', 'C']], ['around', ['B']]],
  )
})

// Perturbing derived.bands is what makes this capable of failing. Re-sorting the fixture's data
// would not: three independent sorts all produce A before C from any input order, so they would
// agree on the answer while still being three implementations. A renderer that grouped and sorted
// for itself would ignore the perturbation entirely and keep emitting A before C.
const flipped = () => {
  const m = loadCampaign(MINI)
  return {
    data: m.data,
    derived: { ...m.derived, bands: m.derived.bands.map((b) => ({ ...b, letters: [...b.letters].reverse() })) },
  }
}

const orderOf = (haystack, ...needles) => needles.map((n) => haystack.indexOf(n))
const ascending = (positions) => positions.every((p, i) => p !== -1 && (i === 0 || positions[i - 1] < p))

test("§4's bands and the contents rail follow derive's order", () => {
  const roadmap = renderRoadmap(flipped())
  const band = roadmap.match(/<div class="band" id="assemble">[\s\S]*?<\/div>\n\n/)[0]
  assert.ok(ascending(orderOf(band, 'id="tC"', 'id="tA"')), 'expected C before A in §4')
  const rail = roadmap.match(/<nav aria-label="Contents">[\s\S]*?<\/nav>/)[0]
  assert.ok(ascending(orderOf(rail, 'href="#tC"', 'href="#tA"')), 'expected C before A in the rail')
})

test("§2's stagerow and §8's census rows follow derive's order", () => {
  const roadmap = renderRoadmap(flipped())
  assert.match(roadmap, /<span class="st-l">C · A<\/span>/)
  const s8 = roadmap.match(/<section id="s8">[\s\S]*?<\/section>/)[0]
  assert.deepEqual([...s8.matchAll(/<td class="ref">([A-Z]) · /g)].map((m) => m[1]), ['C', 'A', 'B'])
})

test("the worklog's coverage strip follows derive's order", () => {
  const strip = renderWorklog(flipped()).match(/data-band="assemble"[\s\S]*?<\/div>/)[0]
  assert.ok(ascending(orderOf(strip, '>C ', '>A ')), 'expected C before A in the strip')
})

test("the thread graph's node layout follows derive's order", () => {
  // Row position within a column, so the graph node sits where the strip letter sits.
  const rowOf = (svg, letter) => {
    const node = svg.match(new RegExp(`<rect x="(\\d+)" y="(\\d+)"[^>]*/><text[^>]*>${letter} `))
    assert.ok(node, `expected a node for ${letter}`)
    return Number(node[2])
  }
  const svg = renderGraph(flipped())
  assert.ok(rowOf(svg, 'C') < rowOf(svg, 'A'), 'expected C above A in the assemble column')
})
