import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadCampaign } from './model.mjs'
import { renderBoard } from './render-board.mjs'
import { checkHtml } from './checks.mjs'

const board = JSON.parse(readFileSync('campaigns/board.json', 'utf8'))
const html = renderBoard([loadCampaign('tools/campaign/fixtures/mini')], board)

test('passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})

test('shows the three roles', () => {
  assert.match(html, /test subject/)
  assert.match(html, /spec/)
  assert.match(html, /other/)
})

test('shows the same totals wording as the worklog strip', () => {
  // The mini fixture has three threads (A/B/C); only A has ever been logged, so the totals are
  // 1 touched, 0 dry, 2 not started — not the 1-thread "1 not started" an earlier draft assumed.
  assert.match(html, /1 touched · 0 dry · 2 not started/)
})

test('shows the newest finding as the resume line', () => {
  assert.match(html, /Dull\./)
})

test('links to both roadmap and worklog', () => {
  assert.match(html, /href="mini\/roadmap\.html"/)
  assert.match(html, /href="mini\/worklog\.html"/)
})

test('a campaign with no findings has a resume line that says so, not a stale finding', () => {
  // Asserting only /not started/ on the whole page also passes on the totals line's own
  // "2 not started" regardless of whether the resume clause works at all — it would pass even
  // against a resume clause that always echoes the newest finding. Isolating the resume line
  // (data-role="resume") and checking it both says "not started" AND does not contain either
  // finding string makes the assertion capable of failing.
  const m = loadCampaign('tools/campaign/fixtures/mini')
  const empty = { data: m.data, derived: { ...m.derived, trail: [], live: [] } }
  const emptyHtml = renderBoard([empty], board)
  const resumeMatch = emptyHtml.match(/<p class="mono" data-role="resume">([\s\S]*?)<\/p>/)
  assert.ok(resumeMatch, 'expected a resume line in the rendered card')
  assert.match(resumeMatch[1], /not started/)
  assert.doesNotMatch(resumeMatch[1], /Dull\./)
  assert.doesNotMatch(resumeMatch[1], /Found a\./)
})

test('the empty-state block shows while there is only one campaign', () => {
  assert.match(html, /No second campaign yet/)
})

test('the empty-state block disappears once a second campaign exists', () => {
  const m = loadCampaign('tools/campaign/fixtures/mini')
  const two = renderBoard([m, m], board)
  assert.doesNotMatch(two, /No second campaign yet/)
  assert.deepEqual(checkHtml(two), [])
})

// ---------- migration acceptance: nothing from the hand-written page silently vanished ----------

test('every board acceptance phrase survives the migration', () => {
  const real = renderBoard([loadCampaign('campaigns/agent-harnesses')], board)
  const phrases = readFileSync('tools/campaign/fixtures/board-acceptance-phrases.txt', 'utf8')
    .split('\n').filter(Boolean)
  const missing = phrases.filter((p) => !real.includes(p))
  assert.deepEqual(missing, [])
})

test('the real board passes every HTML property check', () => {
  const real = renderBoard([loadCampaign('campaigns/agent-harnesses')], board)
  assert.deepEqual(checkHtml(real), [])
})
