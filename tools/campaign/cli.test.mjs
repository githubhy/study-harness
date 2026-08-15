import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (args, opts = {}) =>
  execFileSync('node', ['tools/build-campaign.mjs', ...args], { encoding: 'utf8', ...opts })

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'campaign-'))
  cpSync('tools', join(dir, 'tools'), { recursive: true })
  cpSync('tools/campaign/fixtures/mini', join(dir, 'campaigns/mini'), { recursive: true })
  // --all also renders campaigns/index.html from campaigns/board.json, so the sandbox needs a
  // copy of the real one — the board's own content, not any one campaign's.
  cpSync('campaigns/board.json', join(dir, 'campaigns/board.json'))
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

test('unknown campaign yields a named error, not a stack trace', () => {
  const cwd = sandbox()
  assert.throws(() => run(['unknown'], { cwd }), /campaign\.json/)
})

test('a malformed campaign.json names the file, not just a byte offset', () => {
  // JSON.parse's own message is an offset with no filename, so under --all it could not say which
  // campaign was malformed — the one thing the operator needs to know.
  const cwd = sandbox()
  writeFileSync(join(cwd, 'campaigns/mini/campaign.json'), '{ "campaign": "mini",')
  assert.throws(() => run(['--all'], { cwd }), (err) => {
    assert.match(err.message, /campaigns\/mini\/campaign\.json: is not valid JSON/)
    assert.doesNotMatch(err.message, /at \w+ \(/, 'expected a named error, not a stack trace')
    return true
  })
})

test('--all with no board.json names the file instead of throwing ENOENT', () => {
  // The board is rendered outside the per-campaign try/catch, so this was the one failure path
  // that escaped as an uncaught exception with a stack trace.
  const cwd = sandbox()
  rmSync(join(cwd, 'campaigns/board.json'))
  assert.throws(() => run(['--all'], { cwd }), (err) => {
    assert.match(err.message, /campaigns\/board\.json: does not exist/)
    assert.doesNotMatch(err.message, /at \w+ \(/, 'expected a named error, not a stack trace')
    return true
  })
  // The campaign pages still got written: one missing repo-level file does not lose the rest.
  assert.match(readFileSync(join(cwd, 'campaigns/mini/roadmap.html'), 'utf8'), /<meta charset="utf-8">/)
})

test('runs from a directory other than the repo root', () => {
  // Paths resolve against the module, not the cwd. The empty-cwd assertion is what makes this
  // fail on a regression: a cwd-relative build either throws ENOENT on `campaigns` or writes its
  // pages into whatever directory the shell was sitting in.
  const cwd = sandbox()
  const elsewhere = mkdtempSync(join(tmpdir(), 'elsewhere-'))
  execFileSync('node', [join(cwd, 'tools/build-campaign.mjs'), '--all'], { encoding: 'utf8', cwd: elsewhere })
  assert.match(readFileSync(join(cwd, 'campaigns/mini/worklog.html'), 'utf8'), /<meta charset="utf-8">/)
  assert.match(readFileSync(join(cwd, 'campaigns/index.html'), 'utf8'), /Campaign Board/)
  assert.deepEqual(readdirSync(elsewhere), [])
})

test('--all processes good campaigns and reports bad ones', () => {
  const cwd = sandbox()
  cpSync('tools/campaign/fixtures/mini', join(cwd, 'campaigns/zzz-broken'), { recursive: true })
  const p = join(cwd, 'campaigns/zzz-broken/campaign.json')
  const d = JSON.parse(readFileSync(p, 'utf8'))
  d.log[0].thread = 'invalid'
  writeFileSync(p, JSON.stringify(d))

  assert.throws(() => run(['--all'], { cwd }), /zzz-broken.*campaign\.json/)
  assert.match(readFileSync(join(cwd, 'campaigns/mini/roadmap.html'), 'utf8'), /<meta charset="utf-8">/)
})
