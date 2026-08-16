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

test('a duplicate id is reported, once, however many times it repeats', () => {
  // Worth more than any one id fix: a generated page produces this from one template line whose
  // id comes from data that is not as unique as it looks, and every #anchor to it goes ambiguous.
  const bad = GOOD.replace('<div id="x">here</div>', '<div id="x">here</div><p id="x">again</p><p id="x">thrice</p>')
  assert.deepEqual(checkHtml(bad).filter((p) => /duplicate/.test(p)), ['duplicate id x'])
})

test('unique ids are not reported', () => {
  const fine = GOOD.replace('<div id="x">here</div>', '<div id="x">here</div><p id="y">other</p>')
  assert.deepEqual(checkHtml(fine), [])
})

test('a dangling anchor is reported', () => {
  const bad = GOOD.replace('<div id="x">here</div>', '<div>here</div>')
  assert.ok(checkHtml(bad).some((p) => /#x/.test(p)))
})

test('unbalanced tags are reported', () => {
  assert.ok(checkHtml(GOOD + '<section><div></div>').some((p) => /section/.test(p)))
})

test('bare :root inside @media is not treated as the bare block', () => {
  const html = `<meta charset="utf-8"><style>@media (prefers-color-scheme: dark) { :root { --ink: #eee; } }
:root { --bg: #fff; }
body { background: var(--bg); color: var(--ink); }</style>`
  const problems = checkHtml(html)
  assert.ok(problems.some((p) => /--ink/.test(p)), '--ink should be reported (only in @media)')
  assert.ok(!problems.some((p) => /--bg/.test(p)), '--bg should not be reported (in bare :root)')
})

test('the pre-migration snapshot passes every check', () => {
  const html = readFileSync('tools/campaign/fixtures/roadmap-premigration.html', 'utf8')
  assert.deepEqual(checkHtml(html), [])
})

test('tokens defined in a second bare :root are recognised', () => {
  // The stylesheet opens with a byte-verbatim copied block that must not be
  // edited, so later tokens are appended in a second :root. Reading only the
  // first block reported them as undefined and blocked the build.
  const page = [
    '<meta charset="utf-8">',
    '<style>:root{--ink:#111;--bg:#fff}',
    '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ink:#eee;--bg:#111}}',
    ':root[data-theme="dark"]{--ink:#eee;--bg:#111}',
    ':root{--series-1:#2a78d6}',
    'body{background:var(--bg);color:var(--ink)}',
    '.s{fill:var(--series-1)}</style>',
  ].join('\n')
  assert.deepEqual(checkHtml(page, { anchors: false }), [])
})

test('a token defined in no bare :root is still reported', () => {
  const page = [
    '<meta charset="utf-8">',
    '<style>:root{--ink:#111;--bg:#fff}',
    '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--only-dark:#eee}}',
    'body{background:var(--bg);color:var(--ink)}',
    '.s{fill:var(--only-dark)}</style>',
  ].join('\n')
  assert.ok(checkHtml(page, { anchors: false }).some((p) => /--only-dark/.test(p)))
})
