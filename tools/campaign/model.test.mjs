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
