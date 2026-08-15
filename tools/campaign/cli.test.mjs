import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (args, opts = {}) =>
  execFileSync('node', ['tools/build-campaign.mjs', ...args], { encoding: 'utf8', ...opts })

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'campaign-'))
  cpSync('tools', join(dir, 'tools'), { recursive: true })
  cpSync('tools/campaign/fixtures/mini', join(dir, 'campaigns/mini'), { recursive: true })
  return dir
}

test('writes roadmap.html for a campaign', () => {
  const cwd = sandbox()
  run(['mini'], { cwd })
  assert.match(readFileSync(join(cwd, 'campaigns/mini/roadmap.html'), 'utf8'), /<meta charset="utf-8">/)
})

test('--check passes immediately after a build', () => {
  const cwd = sandbox()
  run(['mini'], { cwd })
  assert.doesNotThrow(() => run(['mini', '--check'], { cwd }))
})

test('--check fails when the committed page has drifted', () => {
  const cwd = sandbox()
  run(['mini'], { cwd })
  const p = join(cwd, 'campaigns/mini/roadmap.html')
  writeFileSync(p, readFileSync(p, 'utf8').replace('Alpha', 'Tampered'))
  assert.throws(() => run(['mini', '--check'], { cwd }), /drift/i)
})

test('a validation error exits non-zero and names the field', () => {
  const cwd = sandbox()
  const p = join(cwd, 'campaigns/mini/campaign.json')
  const d = JSON.parse(readFileSync(p, 'utf8'))
  d.log[0].thread = 'Q'
  writeFileSync(p, JSON.stringify(d))
  assert.throws(() => run(['mini'], { cwd }), /log\[0\]\.thread/)
})
