import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCampaign, derive, loadCampaign } from './model.mjs'

const MINI = 'tools/campaign/fixtures/mini'
const withLog = (log) => derive({ ...readCampaign(MINI), log })

test('an untouched thread is not-started with no pips filled', () => {
  const d = derive(readCampaign(MINI))
  assert.equal(d.threads.get('B').state, 'not-started')
  assert.equal(d.threads.get('B').pips, '○○')
})

test('one unsurprising finding fills one pip and stays live', () => {
  const t = derive(readCampaign(MINI)).threads.get('A')
  assert.equal(t.state, 'live')
  assert.equal(t.run, 1)
  assert.equal(t.pips, '●○')
})

test('two consecutive unsurprising findings go dry', () => {
  const base = readCampaign(MINI).log
  const t = withLog([...base, { thread: 'A', date: '2026-01-04', finding: 'Also dull.',
    surprising: false, note: 'notes/A-alpha.md', opened: [], resolved: [], issue: 9 }])
    .threads.get('A')
  assert.equal(t.state, 'dry')
  assert.equal(t.pips, '●●')
  assert.equal(t.issue, 9)
})

test('a surprising finding resets the run', () => {
  const base = readCampaign(MINI).log
  const t = withLog([...base, { thread: 'A', date: '2026-01-04', finding: 'Surprising!',
    surprising: true, note: 'notes/A-alpha.md', opened: [], resolved: [], issue: null }])
    .threads.get('A')
  assert.equal(t.run, 0)
  assert.equal(t.state, 'live')
  assert.equal(t.pips, '○○')
})

test('entries are replayed in date order regardless of array order', () => {
  const t = withLog([
    { thread: 'A', date: '2026-01-03', finding: 'Dull.', surprising: false,
      note: 'notes/A-alpha.md', opened: [], resolved: [], issue: null },
    { thread: 'A', date: '2026-01-02', finding: 'Found a.', surprising: true,
      note: 'notes/A-alpha.md', opened: [], resolved: [], issue: null },
  ]).threads.get('A')
  assert.equal(t.run, 1)
})

test('totals count touched, dry, and not-started', () => {
  assert.deepEqual(derive(readCampaign(MINI)).totals, { touched: 1, dry: 0, notStarted: 2 })
})

test('an open question appears in the frontier', () => {
  const f = derive(readCampaign(MINI)).frontier
  assert.equal(f.length, 1)
  assert.deepEqual({ id: f[0].id, from: f[0].from, ask: f[0].ask }, { id: 'q1', from: 'A', ask: 'B' })
})

test('a resolved question leaves the frontier', () => {
  const base = readCampaign(MINI).log
  const d = withLog([...base, { thread: 'B', date: '2026-01-05', finding: 'Answered.',
    surprising: true, note: 'notes/B-beta.md', opened: [], resolved: ['q1'], issue: null }])
  assert.deepEqual(d.frontier, [])
})

test('the trail is newest first and carries pips at that point', () => {
  const t = derive(readCampaign(MINI)).trail
  assert.equal(t[0].date, '2026-01-03')
  assert.equal(t[0].pips, '●○')
  assert.equal(t[1].pips, '○○')
})

test('live lists live threads most-recently-touched first', () => {
  assert.deepEqual(derive(readCampaign(MINI)).live, ['A'])
})

test('edges come from opened questions and from gates', () => {
  const e = derive(readCampaign(MINI)).edges
  assert.ok(e.some((x) => x.from === 'A' && x.to === 'B' && x.kind === 'opened'))
  assert.ok(e.some((x) => x.from === 'B' && x.to === 'Phase 3' && x.kind === 'gates'))
})

test('census carries every thread with its packages', () => {
  const c = derive(readCampaign(MINI)).census
  assert.equal(c.length, 3)
  assert.deepEqual(c[0].packages, ['pkg-a', 'shared'])
})

test('loadCampaign returns data and derived together', () => {
  const { data, derived } = loadCampaign(MINI)
  assert.equal(data.campaign, 'mini')
  assert.equal(derived.threads.size, 3)
})
