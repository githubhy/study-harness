import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CSS } from './theme.mjs'
import { checkHtml } from './checks.mjs'

const PAGE = `<meta charset="utf-8">\n${CSS}\n<div id="x"></div>`

test('the theme alone satisfies the HTML property checks', () => {
  assert.deepEqual(checkHtml(PAGE), [])
})

test('all three theme states are present', () => {
  assert.match(CSS, /@media \(prefers-color-scheme: dark\)/)
  assert.match(CSS, /:root:not\(\[data-theme="light"\]\)/)
  assert.match(CSS, /:root\[data-theme="dark"\]/)
})

test('every token redefined in a dark block also exists in the bare :root', () => {
  const bare = new Set([...CSS.match(/:root\s*\{([^}]*)\}/)[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  const after = CSS.slice(CSS.indexOf('@media'))
  for (const m of after.matchAll(/(--[a-z0-9-]+)\s*:/g))
    assert.ok(bare.has(m[1]), `${m[1]} is redefined in a theme block but missing from the bare :root`)
})

test('the copied stylesheet body is present in full, verbatim, from the fixture', () => {
  const fixture = readFileSync(new URL('./fixtures/roadmap-premigration.html', import.meta.url), 'utf8')

  const openTag = '<style>'
  const closeTag = '</style>'
  const openIdx = fixture.indexOf(openTag)
  const closeIdx = fixture.indexOf(closeTag)
  assert.ok(openIdx !== -1 && closeIdx !== -1, 'fixture must contain <style>...</style>')

  // Everything strictly between the two marker lines: skip past the rest of the
  // <style> line (and its trailing newline), stop right before </style>.
  const afterOpenLineEnd = fixture.indexOf('\n', openIdx) + 1
  const innerBody = fixture.slice(afterOpenLineEnd, closeIdx)

  assert.ok(innerBody.length > 0, 'derived inner body must not be empty')
  assert.ok(CSS.includes(innerBody), 'CSS must contain the fixture stylesheet body as one uninterrupted, verbatim run')
})
