import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadCampaign } from './model.mjs'
import { renderRoadmap } from './render-roadmap.mjs'
import { checkHtml } from './checks.mjs'

const SNAP = readFileSync('tools/campaign/fixtures/roadmap-premigration.html', 'utf8')
const html = renderRoadmap(loadCampaign('campaigns/agent-harnesses'))

test('every acceptance phrase survives the migration', () => {
  const phrases = readFileSync('tools/campaign/fixtures/acceptance-phrases.txt', 'utf8')
    .split('\n').filter(Boolean)
  const missing = phrases.filter((p) => !html.includes(p))
  assert.deepEqual(missing, [])
})

test('every package named in the snapshot survives', () => {
  const pkgs = new Set([...SNAP.matchAll(/<span class="pkg">([^<]+)<\/span>/g)].map((m) => m[1]))
  assert.ok(pkgs.size >= 40, `snapshot yielded only ${pkgs.size} packages`)
  const missing = [...pkgs].filter((p) => !html.includes(p))
  assert.deepEqual(missing, [])
})

test('all fifteen threads are present', () => {
  for (const l of 'ABCDEFGHIJKLMNO') assert.match(html, new RegExp(`id="t${l}"`))
})

test('the generated page passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})
