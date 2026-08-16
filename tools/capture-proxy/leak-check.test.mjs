import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHECK = 'tools/capture-proxy/leak-check.mjs'

const run = (args, cwd) => {
  try {
    return { code: 0, out: execFileSync('node', [join(process.cwd(), CHECK), ...args], { cwd, encoding: 'utf8', stdio: 'pipe' }) }
  } catch (err) {
    return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

test('checking nothing is a failure, not a clean report', () => {
  // With no arguments this printed "clean: 0 captures" and exited 0. It was run that way
  // repeatedly during this campaign and reported clean every time, having opened no file.
  const cwd = mkdtempSync(join(tmpdir(), 'leak-none-'))
  const { code, out } = run([], cwd)
  assert.equal(code, 1)
  assert.match(out, /no captures found to check — refusing to report clean/)
})

test('with no arguments it finds every campaign capture by itself', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'leak-find-'))
  mkdirSync(join(cwd, 'campaigns/x/captures'), { recursive: true })
  writeFileSync(join(cwd, 'campaigns/x/captures/session-a.jsonl'),
    `${JSON.stringify({ id: '1', dir: 'request', headers: { authorization: '<redacted>' }, body: {} })}\n`)
  const { code, out } = run([], cwd)
  assert.equal(code, 0)
  assert.match(out, /1 capture checked/)
})

test('an unredacted credential fails, whether in a header or a body', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'leak-hit-'))
  mkdirSync(join(cwd, 'campaigns/x/captures'), { recursive: true })
  writeFileSync(join(cwd, 'campaigns/x/captures/session-a.jsonl'),
    `${JSON.stringify({ id: '1', dir: 'request', headers: { authorization: 'Bearer AAAAAAAAAAAAAAAAAAAA' }, body: {} })}\n`)
  const { code, out } = run([], cwd)
  assert.equal(code, 1)
  assert.match(out, /LEAK/)
  assert.match(out, /written unredacted/)
})

test("the sk- prefix inside an ordinary word is not a credential", () => {
  // The check this replaced fired on `packages/interaction/tool-ask-user`.
  const cwd = mkdtempSync(join(tmpdir(), 'leak-word-'))
  mkdirSync(join(cwd, 'campaigns/x/captures'), { recursive: true })
  writeFileSync(join(cwd, 'campaigns/x/captures/session-a.jsonl'),
    `${JSON.stringify({ id: '1', dir: 'request', headers: {}, body: { text: 'tool-ask-user and risk-model' } })}\n`)
  assert.equal(run([], cwd).code, 0)
})
