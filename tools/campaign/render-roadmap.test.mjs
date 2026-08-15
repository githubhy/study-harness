import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { renderRoadmap } from './render-roadmap.mjs'
import { checkHtml } from './checks.mjs'

const html = renderRoadmap(loadCampaign('tools/campaign/fixtures/mini'))

test('passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})

test('emits an anchor per thread', () => {
  assert.match(html, /id="tA"/)
  assert.match(html, /id="tB"/)
})

test('links each thread to its worklog entry', () => {
  assert.match(html, /href="worklog\.html#tA"/)
})

test('emits no state chips', () => {
  // Scoped to markup, not the whole page: theme.mjs stays a byte-verbatim copy of the
  // pre-migration stylesheet (including its now-inert .c-state rule), so the requirement is
  // "emit no chip element", not "the string c-state may not appear anywhere in the page".
  assert.doesNotMatch(html, /<span class="c-state"/)
  assert.doesNotMatch(html, />not started</)
})

test('escapes shell metacharacters in entry commands', () => {
  assert.match(html, /rg -n &#39;a&#39; \./)
})

test('census and thread cards read the same package array', () => {
  const cards = [...html.matchAll(/class="pkg">([^<]+)</g)].map((m) => m[1])
  assert.ok(cards.includes('shared'))
  assert.match(html, /pkg-a · shared/)
})

test('a census-raised thread is marked as such', () => {
  assert.match(html, /the census/)
})

test('a sparse mini fixture never emits the literal string "undefined"', () => {
  assert.doesNotMatch(html, /undefined/)
})

test('the census re-check command is rendered from specimen.repo', () => {
  assert.match(html, /gh api repos\/acme\/spec-repo\/contents\/packages/)
})

test('a thread with comparison: true gets the CC comparison tag', () => {
  assert.match(html, /<span class="tag t-cc">CC comparison<\/span>/)
})

test('a bullets detail entry renders as a <ul> inside the thread card', () => {
  assert.match(html, /<ul><li>Bullet one\.<\/li><li>Bullet two\.<\/li><\/ul>/)
})

test('a non-null phase halt renders its block', () => {
  assert.match(html, /<div class="h-t">Do not skip<\/div>/)
  assert.match(html, /Halt body <b>bold<\/b>\./)
})

test("the map's caption is rendered from copy.map", () => {
  assert.match(html, /<figcaption>Map caption text\.<\/figcaption>/)
})

test('canonicalTask is interpolated into the standing-order body, not hand-duplicated', () => {
  const s7 = html.match(/<section id="s7">[\s\S]*?<\/section>/)[0]
  assert.match(s7, /<em>"Do the thing\."<\/em>/)
})

test('code() spans survive in a <pre> entry field', () => {
  assert.match(html, /<span class="c"># note<\/span>/)
})

test('nav and §2 use the loop-step label, not a capitalized id', () => {
  assert.match(html, /<h2>Around the loop<\/h2>/)
  assert.match(html, /<span class="st-n">Around the loop<\/span>/)
})

test('census groups rows by loop step rather than sorting all threads alphabetically', () => {
  const s8 = html.match(/<section id="s8">[\s\S]*?<\/section>/)[0]
  const order = [...s8.matchAll(/<td class="ref">([A-Z]) · /g)].map((m) => m[1])
  assert.deepEqual(order, ['A', 'C', 'B'])
})

test('threads sharing raisedBy.text merge into one §5 row', () => {
  assert.match(html, /<tr><td>shortcut a<\/td><td>A\?<\/td><td class="ref">A · C<\/td><\/tr>/)
})

test('the transfer pull quote comes from copy.transferPull', () => {
  assert.match(html, /<p class="pull">Pull quote text\.<\/p>/)
})

test('the masthead kicker uses specimen.short while .facts keeps the full name', () => {
  assert.match(html, /· sp @ abc1234 ·/)
  assert.match(html, /specimen <b>spec<\/b>/)
})
