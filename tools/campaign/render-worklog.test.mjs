import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { renderWorklog } from './render-worklog.mjs'
import { checkHtml } from './checks.mjs'

const html = renderWorklog(loadCampaign('tools/campaign/fixtures/mini'))

test('passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})

test('the coverage strip is sticky', () => {
  assert.match(html, /class="strip"/)
})

test('the strip carries totals and a live index', () => {
  // The mini fixture has three threads (A/assemble, B/around, C/assemble): A is live, B and C
  // have never been logged, so the totals are 1 touched, 0 dry, 2 not started.
  assert.match(html, /1 touched · 0 dry · 2 not started/)
  assert.match(html, /live · A/)
})

test('letters are in fixed alphabetical order within a band', () => {
  // The assemble band now holds both A and C, so this asserts ordering (A before C),
  // not merely that A is present — a stronger check now that the band has two members.
  const band = html.match(/data-band="assemble"[\s\S]*?<\/div>/)[0]
  const aAt = band.indexOf('>A ')
  const cAt = band.indexOf('>C ')
  assert.ok(aAt !== -1 && cAt !== -1, 'expected both A and C pips in the assemble band')
  assert.ok(aAt < cAt, 'expected A before C')
})

test('bands use the loop step label, not its id', () => {
  // The "around" step's label was deliberately set to "Around the loop" (diverging from its id)
  // in an earlier task, to catch a renderer that derives display text from s.id instead of s.label.
  assert.match(html, /Around the loop/)
  assert.doesNotMatch(html, />Around</)
})

test('thread state drives the pip attribute', () => {
  assert.match(html, /data-state="live"[^>]*>A/)
  assert.match(html, /data-state="not-started"[^>]*>B/)
})

test('the frontier lists open questions with from and ask', () => {
  assert.match(html, /Why b\?/)
  assert.match(html, /from A/)
  assert.match(html, /ask B/)
})

test('the trail is newest first', () => {
  assert.ok(html.indexOf('Dull.') < html.indexOf('Found a.'))
})

test('entries link to their note and back to the roadmap', () => {
  assert.match(html, /notes\/A-alpha\.md/)
  assert.match(html, /href="roadmap\.html#tA"/)
})

test('anchors exist for every thread', () => {
  assert.match(html, /id="tA"/)
  assert.match(html, /id="tB"/)
})

test('an empty log renders as "nothing has happened yet", not broken', () => {
  // The real campaign (campaigns/agent-harnesses) has all fifteen threads and an empty log —
  // exactly the "nothing has happened yet" state this property is about. "Not started" is
  // expressed purely by absence: no chip claims it, dashed pips and an empty frontier line do.
  const empty = renderWorklog(loadCampaign('campaigns/agent-harnesses'))
  assert.deepEqual(checkHtml(empty), [])
  assert.match(empty, /0 touched · 0 dry · 15 not started/)
  assert.match(empty, /live · none/)
  assert.match(empty, /No open questions\. The next thread is a fresh pick\./)
  // Scoped to the <a class="pip"> element itself, not the whole page — theme.mjs's CSS also
  // contains the literal string data-state="not-started" in its selector, which would otherwise
  // inflate this count by one.
  const dashed = [...empty.matchAll(/<a class="pip" data-state="not-started"/g)]
  assert.equal(dashed.length, 15)
  for (const l of 'ABCDEFGHIJKLMNO') assert.match(empty, new RegExp(`id="t${l}"`))
})
