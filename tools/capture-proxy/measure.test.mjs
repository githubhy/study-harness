import { test } from 'node:test'
import assert from 'node:assert/strict'
import { measureCapture, measureCampaign, resolveMeasure } from './measure.mjs'

const capture = (requests) =>
  requests.map((body, i) => JSON.stringify({ id: String(i + 1), dir: 'request', body })).join('\n')

test('tool-result sizes are read from the last request, not summed across all', () => {
  // Each request re-sends every earlier tool result. Counting across requests
  // multiplies them by how often the conversation was re-sent — which is how a
  // hand count of these produced 22 where the true figure was 5.
  const text = capture([
    { messages: [{ role: 'system', content: 'x' }, { role: 'tool', content: 'a'.repeat(4000) }] },
    { messages: [
      { role: 'system', content: 'x' },
      { role: 'tool', content: 'a'.repeat(4000) },
      { role: 'tool', content: 'b'.repeat(12) },
    ] },
  ])
  assert.deepEqual(measureCapture(text).toolResultSizes, [4000, 12])
})

test('context bytes and message counts come out per request, in order', () => {
  const text = capture([
    { messages: [{ role: 'user', content: 'a' }] },
    { messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'bb' }] },
  ])
  const m = measureCapture(text)
  assert.equal(m.requests, 2)
  assert.deepEqual(m.messageCounts, [1, 2])
  assert.equal(m.contextBytes.length, 2)
  assert.ok(m.contextBytes[1] > m.contextBytes[0])
})

test('the first request supplies the prompt size, tool count and composition', () => {
  const text = capture([
    { model: 'm', stream: true, tools: [{}, {}, {}],
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hello' }] },
  ])
  const m = measureCapture(text)
  assert.equal(m.systemPromptBytes, 3)
  assert.equal(m.toolsOffered, 3)
  assert.deepEqual(m.firstRequestRoles, ['system', 'user'])
  assert.deepEqual(m.firstRequestBytes, [3, 5])
  assert.deepEqual(m.models, ['m'])
  assert.equal(m.streamed, true)
})

test('a capture with no request bodies measures to nothing rather than throwing', () => {
  assert.equal(measureCapture(JSON.stringify({ id: '1', dir: 'response', body: {} })), null)
})

test('references resolve to whole arrays and to indexed elements', () => {
  const m = { captures: { run: { contextBytes: [10, 20, 30] } } }
  assert.deepEqual(resolveMeasure('@run.contextBytes', m), [10, 20, 30])
  assert.equal(resolveMeasure('@run.contextBytes.1', m), 20)
})

test('an unresolvable reference throws and names what was available', () => {
  const m = { captures: { run: { contextBytes: [1] } } }
  assert.throws(() => resolveMeasure('@missing.contextBytes', m), /no capture "missing".*run/s)
  assert.throws(() => resolveMeasure('@run.nope', m), /no field "nope"/)
  assert.throws(() => resolveMeasure('@run.contextBytes.9', m), /does not resolve/)
})

test('a campaign with no captures measures to an empty set, so the build still runs', () => {
  // Captures are gitignored; a fresh clone has none and must still build.
  assert.deepEqual(measureCampaign('tools/campaign/fixtures/mini'), { captures: {} })
})

test('a capture whose every response failed measures to nothing', () => {
  // The build re-derives measurements.json from whatever captures are on disk, so a failed run
  // left there silently rewrites every number every note cites. This happened: an out-of-credit
  // run captured two 402s, and only the --check gate caught measurements.json being rewritten.
  const failed = [
    JSON.stringify({ id: '1', dir: 'request', body: { messages: [{ role: 'user', content: 'hi' }] } }),
    JSON.stringify({ id: '1', dir: 'response', status: 402, body: { error: { message: 'Insufficient Balance' } } }),
  ].join('\n')
  assert.equal(measureCapture(failed), null)
})

test('a run that succeeded is still measured when a single call failed', () => {
  // Retries are normal; one bad response must not discard a real run.
  const mixed = [
    JSON.stringify({ id: '1', dir: 'request', body: { messages: [{ role: 'user', content: 'hi' }] } }),
    JSON.stringify({ id: '1', dir: 'response', status: 500, body: {} }),
    JSON.stringify({ id: '2', dir: 'request', body: { messages: [{ role: 'user', content: 'hi' }] } }),
    JSON.stringify({ id: '2', dir: 'response', status: 200, body: {} }),
  ].join('\n')
  assert.equal(measureCapture(mixed).requests, 2)
})
