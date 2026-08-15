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
  assert.doesNotMatch(html, /c-state/)
  assert.doesNotMatch(html, /not started/)
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
