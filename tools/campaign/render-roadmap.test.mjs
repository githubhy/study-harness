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

test('a phase note and consumes line render on the blocks footer', () => {
  // Both fields were added by the migration and neither appears in acceptance-phrases.txt, so
  // without this the branches could be dropped and nothing would fail. `note` goes through rich()
  // and keeps its markup; `consumes` is escaped and bolded like `unblocks`.
  assert.match(html, /blocked by <b class="yes">Thread D<\/b> — and <em>not<\/em> on anything else/)
  assert.match(html, /consumes <b>D&#39;s checklist<\/b>/)
})

test('a non-null phase halt renders its block', () => {
  assert.match(html, /<div class="h-t">Do not skip<\/div>/)
  assert.match(html, /Halt body <b>bold<\/b>\./)
})

test("the map's caption is rendered from copy.map", () => {
  assert.match(html, /<figcaption>Map caption text\.<\/figcaption>/)
})

test('canonicalTask is interpolated into the standing-order body, not hand-duplicated', () => {
  const s7 = html.match(/<section id="s7">[\s\S]*?<\/section>/)[0]
  assert.match(s7, /<em>"Do the thing\."<\/em>/)
})

test('code() spans survive in a <pre> entry field', () => {
  assert.match(html, /<span class="c"># note<\/span>/)
})

test('nav and §2 use the loop-step label, not a capitalized id', () => {
  assert.match(html, /<h2>Around the loop<\/h2>/)
  assert.match(html, /<span class="st-n">Around the loop<\/span>/)
})

test('census groups rows by loop step rather than sorting all threads alphabetically', () => {
  const s8 = html.match(/<section id="s8">[\s\S]*?<\/section>/)[0]
  const order = [...s8.matchAll(/<td class="ref">([A-Z]) · /g)].map((m) => m[1])
  assert.deepEqual(order, ['A', 'C', 'B'])
})

test('§5 emits one row per questionIndex entry, with its own question wording', () => {
  const s5 = html.match(/<section id="s5">[\s\S]*?<\/section>/)[0]
  // One row per entry — not one per thread, and not one per distinct shortcut.
  const rows = [...s5.matchAll(/<tr><td>((?:(?!<\/td>).)*)<\/td><td>((?:(?!<\/td>).)*)<\/td><td class="ref">([^<]*)<\/td><\/tr>/g)]
  assert.deepEqual(rows.map((m) => [m[1], m[2], m[3]]), [
    ['Shortcut <code>a()</code>', 'What does a do?', 'A · C'],
    ['Shortcut b', 'What does b do?', 'A'],
  ])
})

test('§5 keeps the inline <code> that the same entry’s FROM line does not carry', () => {
  // The source sets these two surfaces differently on purpose: §5 indexes code constructs in
  // sentence case with <code>, the cards run the same shortcut as lowercase prose inside an
  // already-monospaced line. One string for both would have to lose one of them.
  const s5 = html.match(/<section id="s5">[\s\S]*?<\/section>/)[0]
  assert.match(s5, /<tr><td>Shortcut <code>a\(\)<\/code><\/td>/)

  const cardA = html.match(/<article class="thread"[^>]*id="tA">[\s\S]*?<\/article>/)[0]
  const fromLine = cardA.match(/<p class="t-from[^"]*">FROM .*?<\/p>/)[0]
  assert.match(fromLine, /<b>shortcut a<\/b>/)
  assert.doesNotMatch(fromLine, /<code>/)
})

test('a thread named by two questionIndex entries shows both shortcuts in its FROM line', () => {
  // The many-to-many case: A is raised by two shortcuts, one of which also raises C. A one-field
  // raisedBy could only ever express one of them, which is what dropped content before.
  const cardA = html.match(/<article class="thread"[^>]*id="tA">[\s\S]*?<\/article>/)[0]
  assert.match(cardA, /<p class="t-from">FROM <b>shortcut a<\/b> · <b>shortcut b<\/b><\/p>/)
  const cardC = html.match(/<article class="thread"[^>]*id="tC">[\s\S]*?<\/article>/)[0]
  assert.match(cardC, /<p class="t-from">FROM <b>shortcut a<\/b><\/p>/)
})

test('a census-raised thread keeps its own FROM text, having no questionIndex entry', () => {
  const cardB = html.match(/<article class="thread"[^>]*id="tB">[\s\S]*?<\/article>/)[0]
  assert.match(cardB, /<p class="t-from census">FROM <b>the census<\/b><\/p>/)
})

test('the package total falls back to the derived count when none is claimed', () => {
  // mini states no specimen.packageCount: pkg-a, shared, pkg-b, pkg-c, util = 5.
  assert.match(html, /Package census · all 5 accounted for/)
  assert.match(html, /packages <b>5<\/b>, all covered/)
})

test('the transfer pull quote comes from copy.transferPull', () => {
  const s6 = html.match(/<section id="s6">[\s\S]*?<\/section>/)[0]
  assert.match(s6, /<p class="pull">Pull quote text\.<\/p>/)
})

test('no unreplaced {{token}} survives rendering', () => {
  // General rather than canonicalTask-specific, so it also catches a misspelled token
  // (e.g. {{canonicalTasks}}) added later — an exact-literal match means a typo would
  // otherwise render the literal braces onto the page instead of failing loudly.
  assert.doesNotMatch(html, /\{\{/)
})

test('the masthead kicker uses specimen.short while .facts keeps the full name', () => {
  assert.match(html, /· sp @ abc1234 ·/)
  assert.match(html, /specimen <b>spec<\/b>/)
})
