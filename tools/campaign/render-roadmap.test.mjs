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
