import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign, readCampaign, derive } from './model.mjs'
import { renderWorklog } from './render-worklog.mjs'
import { checkHtml } from './checks.mjs'

const html = renderWorklog(loadCampaign('tools/campaign/fixtures/mini'))

/**
 * A campaign's threads with its log emptied.
 *
 * The two empty-state tests below used to read the real campaign directly, back when its log
 * happened to be empty. That made them assertions that nothing had been logged yet — they went
 * red on the first genuine finding, which is the one moment the empty state stops being worth
 * testing and starts being unreachable. Stating the precondition here keeps them about rendering.
 */
const emptyLog = (dir) => {
  const data = { ...readCampaign(dir), log: [] }
  return { data, derived: derive(data) }
}

test('passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})

test('the coverage strip is sticky', () => {
  assert.match(html, /class="strip"/)
})

test('the strip carries totals and a live index', () => {
  // The mini fixture has three threads (A/assemble, B/around, C/assemble): A is live, B and C
  // have never been logged, so the totals are 1 touched, 0 dry, 2 not started.
  assert.match(html, /1 touched · 0 dry · 2 not started/)
  assert.match(html, /live · A/)
})

test('letters are in fixed alphabetical order within a band', () => {
  // The assemble band now holds both A and C, so this asserts ordering (A before C),
  // not merely that A is present — a stronger check now that the band has two members.
  const band = html.match(/data-band="assemble"[\s\S]*?<\/div>/)[0]
  const aAt = band.indexOf('>A ')
  const cAt = band.indexOf('>C ')
  assert.ok(aAt !== -1 && cAt !== -1, 'expected both A and C pips in the assemble band')
  assert.ok(aAt < cAt, 'expected A before C')
})

test('bands use the loop step label, not its id', () => {
  // The "around" step's label was deliberately set to "Around the loop" (diverging from its
  // lowercase id "around") in an earlier task, to catch a renderer that derives display text
  // from s.id instead of s.label. A renderer reading s.id would emit the bare, lowercase id as
  // the band's text content — ">around<" — which this checks for directly; the earlier version
  // of this assertion checked for ">Around<" (capitalized), a string a buggy renderer would
  // never emit either way, so it passed regardless of which field the renderer read.
  assert.match(html, /Around the loop/)
  assert.doesNotMatch(html, />around</)
})

test('thread state drives the pip attribute', () => {
  assert.match(html, /data-state="live"[^>]*>A/)
  assert.match(html, /data-state="not-started"[^>]*>B/)
})

test('the frontier lists open questions with from and ask', () => {
  assert.match(html, /Why b\?/)
  assert.match(html, /from A/)
  assert.match(html, /ask B/)
})

test('the trail is newest first', () => {
  assert.ok(html.indexOf('Dull.') < html.indexOf('Found a.'))
})

test('entries link to their note and back to the roadmap', () => {
  assert.match(html, /notes\/A-alpha\.md/)
  assert.match(html, /href="roadmap\.html#tA"/)
})

test('anchors exist for every thread', () => {
  assert.match(html, /id="tA"/)
  assert.match(html, /id="tB"/)
})

test("a thread's anchor sits on its own block, not in a clump above the trail", () => {
  // #tA must land on A's group heading — the top of everything A found — which is what the strip's
  // A pip and the roadmap's → worklog link both point at. Two earlier shapes were wrong in opposite
  // directions: all fifteen anchors emitted as bare spans under the Trail heading, so every letter
  // hopped to the same spot; then on the newest single entry, which was the only place a thread
  // could be said to begin while the trail was flat and chronological.
  const groups = [...html.matchAll(/<section class="tgroup"[^>]*id="t([A-O])"[\s\S]*?<\/section>/g)]
  const a = groups.filter((m) => m[1] === 'A')
  assert.equal(a.length, 1, 'expected exactly one block to carry #tA')
  // A has two entries and both are inside its block, newest first.
  assert.equal([...a[0][0].matchAll(/<div class="entry"/g)].length, 2)
  assert.ok(a[0][0].indexOf('2026-01-03') < a[0][0].indexOf('2026-01-02'), 'newest entry first')
  const betweenHeadingAndTrail = html.match(/Trail<\/h2>\n([\s\S]*?)<section class="tgroup"/)[1]
  assert.doesNotMatch(betweenHeadingAndTrail, /id="tA"/)
})

test('the trail groups by thread, in the same order as the coverage strip', () => {
  // A flat chronological list was the wrong axis for a campaign whose entries all share one date:
  // the dates sorted nothing, and the thread — the axis a reader navigates by — appeared only as a
  // repeated label. The two orderings must agree, or a pip and the block it jumps to disagree.
  const pips = [...html.matchAll(/class="pip"[^>]*href="#t([A-O])"/g)].map((m) => m[1])
  const groups = [...html.matchAll(/<section class="tgroup"[^>]*id="t([A-O])"/g)].map((m) => m[1])
  assert.deepEqual(groups, pips.filter((l) => groups.includes(l)))
  // Every entry lives under the thread that produced it.
  for (const g of html.matchAll(/<section class="tgroup"[^>]*id="t([A-O])"([\s\S]*?)<\/section>/g))
    for (const e of g[2].matchAll(/id="e-([A-O])/g))
      assert.equal(e[1], g[1], `an entry from ${e[1]} is filed under ${g[1]}`)
})

test('a thread with no entries keeps a fallback anchor so the roadmap link never dangles', () => {
  // B and C are never logged in the mini fixture. They have no trail entry to sit on, so they get
  // the bare anchor — and only they do.
  const betweenHeadingAndTrail = html.match(/Trail<\/h2>\n([\s\S]*?)<div class="entry"/)[1]
  assert.match(betweenHeadingAndTrail, /id="tB"/)
  assert.match(betweenHeadingAndTrail, /id="tC"/)
  assert.deepEqual(checkHtml(html), [])
})

test("each trail entry shows its own stamped pips, not the thread's current pips", () => {
  // model.mjs stamps e.pips at write time, capturing the run as it stood when that entry was
  // logged: A's 2026-01-02 entry (surprising) resets to ○○, then 2026-01-03 (unsurprising)
  // advances to ●○. If the renderer read t.pips (the thread's final pips) instead of e.pips for
  // every row, both entries would show the same ●○ and this test would catch it — the other
  // tests in this file don't, since they never look at a specific pip glyph.
  const newest = html.match(/<span class="mono">([^<]+) 2026-01-03<\/span>/)
  const oldest = html.match(/<span class="mono">([^<]+) 2026-01-02<\/span>/)
  assert.ok(newest && oldest, 'expected both dated entries to render their pips span')
  assert.equal(newest[1], '●○')
  assert.equal(oldest[1], '○○')
})

test('only the tipping entry carries the dry state; earlier entries on the same thread stay live', () => {
  // Nothing in the mini fixture ever goes dry (A's run only reaches 1 against a budget of 2), so
  // this builds a synthetic log the same way derive.test.mjs does: append a third entry to A that
  // pushes its run to the budget. The render-worklog `state` branch is
  // `t.state === 'dry' && e === t.entries.at(-1)` — only the last entry should read data-state
  // "dry"; the two earlier ones on the same now-dry thread must still read "live".
  const base = readCampaign('tools/campaign/fixtures/mini')
  const data = { ...base, log: [...base.log, {
    thread: 'A', date: '2026-01-04', finding: 'Also dull.', surprising: false,
    note: 'notes/A-alpha.md', opened: [], resolved: [], issue: 9,
  }] }
  const dryHtml = renderWorklog({ data, derived: derive(data) })
  assert.deepEqual(checkHtml(dryHtml), [])

  const byDate = Object.fromEntries(
    [...dryHtml.matchAll(/<div class="entry" data-state="([^"]+)" id="e-A(\d{4}-\d{2}-\d{2})-\d+">/g)]
      .map((m) => [m[2], m[1]]))
  assert.equal(byDate['2026-01-02'], 'live')
  assert.equal(byDate['2026-01-03'], 'live')
  assert.equal(byDate['2026-01-04'], 'dry')
  assert.match(dryHtml, /filed #9/)
})

test('two findings on one thread on one day get distinct entry ids', () => {
  // thread + date was not unique. Two findings on one thread on one day collided, which the new
  // id-uniqueness rule in checkHtml now catches for any page, not just this one.
  const base = readCampaign('tools/campaign/fixtures/mini')
  const twice = { ...base, log: [...base.log, {
    thread: 'A', date: '2026-01-03', finding: 'And another.', surprising: true,
    note: 'notes/A-alpha.md', opened: [], resolved: [], issue: null,
  }] }
  const out = renderWorklog({ data: twice, derived: derive(twice) })
  assert.deepEqual(checkHtml(out), [])
  const ids = [...out.matchAll(/<div class="entry"[^>]*id="(e-[^"]+)"/g)].map((m) => m[1])
  assert.equal(ids.length, 3)
  assert.equal(new Set(ids).size, 3)
})

test('the Trail has an empty state, as the frontier does', () => {
  // With an empty log the section used to be a bare heading with nothing under it, while the
  // frontier immediately above it said so in words.
  const empty = renderWorklog(emptyLog('campaigns/agent-harnesses'))
  const section = empty.match(/<h2 class="sec">Trail<\/h2>[\s\S]*?<\/section>/)[0]
  assert.match(section, /Nothing logged yet\. The first finding starts the trail\./)
  // And it is not shown once there is a trail.
  assert.doesNotMatch(html, /Nothing logged yet/)
})

test('the page says it is generated and names the command that rebuilds it', () => {
  assert.match(html, /Generated by tools\/build-campaign\.mjs/)
  assert.match(html, /node tools\/build-campaign\.mjs --all/)
})

test('an empty log renders as "nothing has happened yet", not broken', () => {
  // Fifteen threads, none logged — the "nothing has happened yet" state. "Not started" is
  // expressed purely by absence: no chip claims it, dashed pips and an empty frontier line do.
  const empty = renderWorklog(emptyLog('campaigns/agent-harnesses'))
  assert.deepEqual(checkHtml(empty), [])
  assert.match(empty, /0 touched · 0 dry · 15 not started/)
  assert.match(empty, /live · none/)
  assert.match(empty, /No open questions\. The next thread is a fresh pick\./)
  // Scoped to the <a class="pip"> element itself, not the whole page — theme.mjs's CSS also
  // contains the literal string data-state="not-started" in its selector, which would otherwise
  // inflate this count by one.
  const dashed = [...empty.matchAll(/<a class="pip" data-state="not-started"/g)]
  assert.equal(dashed.length, 15)
  for (const l of 'ABCDEFGHIJKLMNO') assert.match(empty, new RegExp(`id="t${l}"`))
})

test('an omitted optional section leaves no blank-line trace', () => {
  // renderWorklog builds the page as an array of fragments joined with '\n'. An optional
  // fragment that renders as '' -- e.g. renderGraph(), which returns '' for the real campaign
  // (its log is empty, so it has no 'opened' edges to draw) -- used to survive the join as a
  // stray blank line: the array held an empty-string entry, and '\n' + '' + '\n' is a blank
  // line. That is exactly what shipped in campaigns/agent-harnesses/worklog.html once: the
  // committed page disagreed with what the renderer actually produces, purely because of one
  // extra blank line `--check` exists to catch drift like that, but nothing in this suite
  // checked the property directly, so a section left out could silently reshape the page again
  // without any test noticing. This pins the property: omitting an optional region must leave
  // no trace, not even whitespace.
  //
  // The <style> block (theme.mjs's CSS, always present, never optional) is excluded because it
  // carries its own deliberate blank lines for human readability -- collapsing it back to a
  // single line boundary avoids a false positive from stripping it out, not from a bug.
  const real = renderWorklog(loadCampaign('campaigns/agent-harnesses'))
  const body = real.replace(/\n<style>[\s\S]*?<\/style>\n/, '\n')
  assert.doesNotMatch(body, /\n\s*\n/)
})

test('a resolution names the question it closed and who asked it', () => {
  // Closing a question used to be invisible: it left the frontier and nothing said why. Both
  // halves of the graph must render, or the trail shows questions vanishing rather than answered.
  const base = readCampaign('campaigns/agent-harnesses')
  const data = {
    ...base,
    log: [
      { thread: 'B', date: '2026-08-16', finding: 'Asks.', surprising: true, note: 'notes/B-agent-loop.md',
        opened: [{ id: 'q-x', q: 'What stops a runaway run?', ask: 'J' }], resolved: [], issue: null },
      { thread: 'J', date: '2026-08-17', finding: 'Answers.', surprising: true, note: 'notes/B-agent-loop.md',
        opened: [], resolved: ['q-x'], issue: null },
    ],
  }
  const derived = derive(data)
  const out = renderWorklog({ data, derived })

  assert.match(out, /→ answered B: What stops a runaway run\?/)
  assert.equal(derived.frontier.length, 0)              // and it leaves the frontier
  assert.deepEqual(checkHtml(out), [])
})

test('an entry resolving nothing renders no answered line', () => {
  const base = readCampaign('campaigns/agent-harnesses')
  const data = {
    ...base,
    log: [{ thread: 'B', date: '2026-08-16', finding: 'Only.', surprising: true,
      note: 'notes/B-agent-loop.md', opened: [], resolved: [], issue: null }],
  }
  assert.doesNotMatch(renderWorklog({ data, derived: derive(data) }), /answered/)
})
