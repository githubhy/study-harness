import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkHtml } from './checks.mjs'

const GOOD = [
  '<meta charset="utf-8">',
  '<style>:root{--ink:#111;--bg:#fff}',
  '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ink:#eee;--bg:#111}}',
  ':root[data-theme="dark"]{--ink:#eee;--bg:#111}',
  'body{background:var(--bg);color:var(--ink)}</style>',
  '<a href="#x">go</a><div id="x">here</div>',
].join('\n')

test('clean html reports no problems', () => {
  assert.deepEqual(checkHtml(GOOD), [])
})

test('missing charset is reported', () => {
  assert.match(checkHtml(GOOD.replace('<meta charset="utf-8">', ''))[0], /charset/)
})

test('charset beyond 1024 bytes is reported', () => {
  const padded = '<!-- ' + 'x'.repeat(1100) + ' -->\n' + GOOD
  assert.ok(checkHtml(padded).some((p) => /charset/.test(p)))
})

test('external references are reported', () => {
  const bad = GOOD.replace('<a href', '<script src="x.js"></script><a href')
  assert.ok(checkHtml(bad).some((p) => /external/.test(p)))
})

test('details elements are reported', () => {
  assert.ok(checkHtml(GOOD + '<details><summary>x</summary></details>')
    .some((p) => /details/.test(p)))
})

test('a token used but not defined in bare :root is reported', () => {
  const bad = GOOD.replace('color:var(--ink)', 'color:var(--nope)')
  assert.ok(checkHtml(bad).some((p) => /--nope/.test(p)))
})

test('a dangling anchor is reported', () => {
  const bad = GOOD.replace('<div id="x">here</div>', '<div>here</div>')
  assert.ok(checkHtml(bad).some((p) => /#x/.test(p)))
})

test('unbalanced tags are reported', () => {
  assert.ok(checkHtml(GOOD + '<section><div></div>').some((p) => /section/.test(p)))
})

test('the pre-migration snapshot passes every check', () => {
  const html = readFileSync('tools/campaign/fixtures/roadmap-premigration.html', 'utf8')
  assert.deepEqual(checkHtml(html), [])
})
