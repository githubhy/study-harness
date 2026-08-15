import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCampaign } from './model.mjs'

const MINI = 'tools/campaign/fixtures/mini'
const clone = () => structuredClone(readCampaign(MINI))

test('reads the mini campaign', () => {
  const d = readCampaign(MINI)
  assert.equal(d.campaign, 'mini')
  assert.equal(d.threads.length, 3)
  assert.equal(d.dir, MINI)
})

test('rejects a duplicate thread letter', () => {
  const d = clone()
  d.threads[1].letter = 'A'
  assert.throws(() => readCampaign(MINI, d), /duplicate thread letter A/)
})

test('rejects a letter outside A-O', () => {
  const d = clone()
  d.threads[1].letter = 'Z'
  assert.throws(() => readCampaign(MINI, d), /thread letter Z/)
})

test('rejects a log entry naming an unknown thread', () => {
  const d = clone()
  d.log[0].thread = 'Q'
  assert.throws(() => readCampaign(MINI, d), /log\[0\].thread/)
})

test('rejects an opened question asking an unknown thread', () => {
  const d = clone()
  d.log[0].opened[0].ask = 'Q'
  assert.throws(() => readCampaign(MINI, d), /ask/)
})

test('rejects a resolved id that was never opened', () => {
  const d = clone()
  d.log[1].resolved = ['never-asked']
  assert.throws(() => readCampaign(MINI, d), /never-asked/)
})

test('rejects a thread naming an unknown loop step', () => {
  const d = clone()
  d.threads[0].loop = 'nowhere'
  assert.throws(() => readCampaign(MINI, d), /loop step nowhere/)
})

test('rejects a missing note file', () => {
  const d = clone()
  d.log[0].note = 'notes/does-not-exist.md'
  assert.throws(() => readCampaign(MINI, d), /does-not-exist\.md/)
})

test('rejects an unparseable date', () => {
  const d = clone()
  d.log[0].date = 'last tuesday'
  assert.throws(() => readCampaign(MINI, d), /last tuesday/)
})

test('accepts a package shared by two threads', () => {
  const d = readCampaign(MINI)
  const shared = d.threads.filter((t) => t.packages.includes('shared'))
  assert.equal(shared.length, 2)
})

test('rejects gates pointing to unknown phase', () => {
  const d = clone()
  d.threads[1].gates = 'Unknown Phase'
  assert.throws(() => readCampaign(MINI, d), /thread B gates Unknown Phase is not a known phase/)
})

test('accepts gates: null', () => {
  const d = clone()
  d.threads[0].gates = null
  const result = readCampaign(MINI, d)
  assert.equal(result.threads[0].gates, null)
})

test('rejects a questionIndex entry naming an unknown thread', () => {
  const d = clone()
  d.questionIndex[0].threads = ['Q']
  assert.throws(() => readCampaign(MINI, d), /questionIndex\[0\] names unknown thread Q/)
})

test('rejects a toy-raised thread that no questionIndex entry names', () => {
  // The symmetric half of the check above. A toy thread derives its FROM line from the index, so
  // one that no entry names renders "FROM " — an empty line, with nothing to signal the loss.
  const d = clone()
  d.questionIndex = d.questionIndex.map((e) => ({ ...e, threads: e.threads.filter((l) => l !== 'C') }))
  assert.throws(() => readCampaign(MINI, d), /thread C is toy-raised but no questionIndex entry names it/)
})

test('a census-raised thread needs no questionIndex entry', () => {
  // B is census-raised and named by no entry; it carries raisedBy.text instead.
  const d = readCampaign(MINI)
  assert.equal(d.threads[1].raisedBy.kind, 'census')
  assert.ok(!d.questionIndex.some((e) => e.threads.includes('B')))
})

test('rejects a missing surprise budget', () => {
  // The budget sizes every pip string and decides when a thread goes dry. Removing it used to
  // exit 0: Math.min(run, undefined) is NaN so pips render empty, and run >= undefined is never
  // true so nothing goes dry. The whole mechanic disappears without one failing check.
  const d = clone()
  delete d.surpriseBudget
  assert.throws(() => readCampaign(MINI, d), /surpriseBudget undefined is not a positive integer/)
})

test('rejects a non-integer or non-positive surprise budget', () => {
  for (const bad of [0, -1, 1.5, '2', null]) {
    const d = clone()
    d.surpriseBudget = bad
    assert.throws(() => readCampaign(MINI, d), /surpriseBudget .* is not a positive integer/,
      `expected surpriseBudget ${JSON.stringify(bad)} to be rejected`)
  }
})

test('rejects a log entry with no opened array', () => {
  // Appending a log entry is the only hand edit in the update loop, so this is the likeliest
  // hand-edit error there is. Before the check it surfaced as "e.opened is not iterable" — no
  // entry index, no file path, and under --all no way to tell which campaign.
  const d = clone()
  delete d.log[0].opened
  assert.throws(() => readCampaign(MINI, d), /log\[0\]\.opened is not an array/)
})

test('rejects a log entry with no resolved array', () => {
  const d = clone()
  delete d.log[1].resolved
  assert.throws(() => readCampaign(MINI, d), /log\[1\]\.resolved is not an array/)
})

test('the log-shape failure names the campaign.json it came from', () => {
  // Under --all the entry index alone is ambiguous; the path is what disambiguates.
  const d = clone()
  delete d.log[0].opened
  assert.throws(() => readCampaign(MINI, d), new RegExp(`${MINI}/campaign\\.json`))
})

test('rejects a thread with no raisedBy', () => {
  const d = clone()
  delete d.threads[0].raisedBy
  assert.throws(() => readCampaign(MINI, d), /thread A raisedBy\.kind is undefined/)
})

test('rejects a census-raised thread with no raisedBy.text', () => {
  // B is the fixture's census-raised thread; its FROM line is raisedBy.text and nothing else can
  // supply one, since a census thread has no questionIndex entry by definition.
  const d = clone()
  delete d.threads[1].raisedBy.text
  assert.throws(() => readCampaign(MINI, d), /thread B is census-raised but carries no raisedBy\.text/)
})

test('rejects missing loopSteps array', () => {
  const d = clone()
  d.loopSteps = null
  assert.throws(() => readCampaign(MINI, d), /loopSteps is not an array/)
})

test('rejects missing phases array', () => {
  const d = clone()
  d.phases = null
  assert.throws(() => readCampaign(MINI, d), /phases is not an array/)
})
