import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderNote, renderNoteBody } from './render-note.mjs'
import { checkHtml } from './checks.mjs'

test('code spans survive, and their contents are not read as markup', () => {
  const html = renderNoteBody('Run `rm -f *.tmp` and `a **b** c` now.')
  assert.match(html, /<code>rm -f \*\.tmp<\/code>/)
  // The asterisks inside the second span must stay literal, not become <strong>.
  assert.match(html, /<code>a \*\*b\*\* c<\/code>/)
  assert.doesNotMatch(html, /<code>[^<]*<strong>/)
})

test('emphasis applies outside code only', () => {
  const html = renderNoteBody('**bold** and *italic* and `**not bold**`')
  assert.match(html, /<strong>bold<\/strong>/)
  assert.match(html, /<em>italic<\/em>/)
  assert.match(html, /<code>\*\*not bold\*\*<\/code>/)
})

test('a digit between spaces is not mistaken for a code placeholder', () => {
  // The earlier implementation substituted ` N ` markers and restored them,
  // so ordinary prose containing a spaced digit came back wrapped in <code>.
  const html = renderNoteBody('It sent 10,416 tokens over 3 calls and 4 steps.')
  assert.doesNotMatch(html, /<code>/)
  assert.match(html, /over 3 calls and 4 steps/)
})

test('tables render with their header row', () => {
  const html = renderNoteBody('| a | b |\n|---|---|\n| 1 | 2 |\n')
  assert.match(html, /<th>a<\/th><th>b<\/th>/)
  assert.match(html, /<td>1<\/td><td>2<\/td>/)
  assert.doesNotMatch(html, /---/)
})

test('fenced code blocks are escaped, not interpreted', () => {
  const html = renderNoteBody('```\n<script>alert(1)</script>\n**x**\n```')
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.doesNotMatch(html, /<strong>/)
})

test('a paragraph stops at the next block rather than swallowing it', () => {
  const html = renderNoteBody('text one\n## Heading\ntext two')
  assert.match(html, /<p class="lede">text one<\/p>/)
  assert.match(html, /<h2 class="sec">Heading<\/h2>/)
})

test('links render with an escaped href', () => {
  const html = renderNoteBody('see [the note](notes/01.html) here')
  assert.match(html, /<a href="notes\/01\.html">the note<\/a>/)
})

test('a rendered real note passes every HTML property check', () => {
  const markdown = readFileSync('campaigns/agent-harnesses/notes/01-what-my-harness-lacks.md', 'utf8')
  // Charts cite measurements by reference, so the renderer needs them — exactly
  // as the build supplies them. Omitting them must throw, not draw an empty chart.
  const measurements = JSON.parse(readFileSync('campaigns/agent-harnesses/measurements.json', 'utf8'))
  const html = renderNote({ markdown, campaign: 'agent-harnesses', title: 'What my harness lacks', measurements })
  assert.deepEqual(checkHtml(html), [])
  assert.doesNotMatch(html, /undefined/)
  assert.match(html, /href="roadmap\.html"/)
})

test('a chart citing a measurement fails loudly when none is supplied', () => {
  // Better a stopped build than a page with a blank figure nobody notices.
  assert.throws(() => renderNoteBody('```chart\nkind: series\nseries: a | @run.contextBytes\n```'),
    /no capture "run"/)
})
