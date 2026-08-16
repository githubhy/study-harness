// Proves the capture proxy forwards, tees, and redacts — against a stub upstream,
// so it needs no API key and costs nothing. The planted key is the point: if it
// ever reaches disk, this test fails and the leak check fails with it.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { spawn } from 'node:child_process'
import { readFileSync, rmSync, existsSync } from 'node:fs'

const CAPTURE = 'campaigns/agent-harnesses/captures/session-smoke.jsonl'
const PLANTED_KEY = 'sk-SMOKETESTdeadbeefdeadbeefdeadbeef'

let upstream
let proxy
let upstreamPort
let proxyPort

/**
 * Resolve once the port accepts a TCP connection, so the test never races the
 * listener. Deliberately not an HTTP request: anything sent through the proxy
 * lands in the capture, and a readiness probe must not appear in the data the
 * assertions below then read.
 */
const waitForPort = async (port) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const open = await new Promise((resolve) => {
      const socket = connect(port, '127.0.0.1')
      socket.once('connect', () => { socket.destroy(); resolve(true) })
      socket.once('error', () => { socket.destroy(); resolve(false) })
    })
    if (open) return
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`nothing listening on ${port}`)
}

/** The exchange under test, not any other traffic that reached the proxy. */
const captured = () => {
  const lines = readFileSync(CAPTURE, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const request = lines.find((l) => l.dir === 'request' && l.url === '/chat/completions')
  assert.ok(request, 'no /chat/completions request in the capture')
  return { request, response: lines.find((l) => l.dir === 'response' && l.id === request.id) }
}

before(async () => {
  if (existsSync(CAPTURE)) rmSync(CAPTURE)

  // A stub that answers like an OpenAI-compatible streaming endpoint.
  upstream = createServer((req, res) => {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'set-cookie': `session=${PLANTED_KEY}`, // a second place a secret could leak from
    })
    res.write('data: {"choices":[{"delta":{"content":"Fizz"}}]}\n\n')
    res.write('data: {"choices":[{"delta":{"content":"Buzz"}}]}\n\n')
    res.write('data: [DONE]\n\n')
    res.end()
  })
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r))
  upstreamPort = upstream.address().port

  proxyPort = upstreamPort + 1
  proxy = spawn('node', ['tools/capture-proxy/server.mjs'], {
    env: {
      ...process.env,
      CAPTURE_PORT: String(proxyPort),
      CAPTURE_UPSTREAM: `http://127.0.0.1:${upstreamPort}`,
      CAPTURE_FILE: CAPTURE,
    },
    stdio: 'ignore',
  })
  await waitForPort(proxyPort)
})

after(() => {
  proxy?.kill()
  upstream?.close()
})

test('forwards the upstream stream to the client intact', async () => {
  const res = await fetch(`http://127.0.0.1:${proxyPort}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${PLANTED_KEY}`,
      'x-api-key': PLANTED_KEY,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a harness under study.' },
        { role: 'user', content: 'FizzBuzz to 20.' },
      ],
      tools: [{ type: 'function', function: { name: 'write_file' } }],
    }),
  })
  const text = await res.text()
  assert.equal(res.status, 200)
  assert.match(text, /Fizz/)
  assert.match(text, /\[DONE\]/)
})

test('the capture holds no credential, in any field', () => {
  const raw = readFileSync(CAPTURE, 'utf8')
  assert.doesNotMatch(raw, /sk-/, 'an API key reached disk')
  assert.doesNotMatch(raw, /Bearer /, 'an authorization header reached disk')
  assert.doesNotMatch(raw, new RegExp(PLANTED_KEY), 'the planted key reached disk')
})

test('redacts request, response, and set-cookie headers alike', () => {
  const { request, response } = captured()
  assert.equal(request.headers.authorization, '<redacted>')
  assert.equal(request.headers['x-api-key'], '<redacted>')
  assert.equal(response.headers['set-cookie'], '<redacted>')
})

test('keeps the shape the roadmap jq commands query', () => {
  const { request } = captured()
  // roadmap Thread A: select(.dir=="request") | .body.messages[] | select(.role=="system")
  assert.equal(request.body.messages.find((m) => m.role === 'system').content,
    'You are a harness under study.')
  // roadmap Phase 3: select(.dir=="request") | .body.tools[]? | .function.name
  assert.deepEqual(request.body.tools.map((t) => t.function.name), ['write_file'])
  // roadmap Thread C: "\(.id)\t\(.body.messages|length)"
  assert.equal(typeof request.id, 'string')
  assert.equal(request.body.messages.length, 2)
})

test('preserves SSE frame boundaries rather than parsing them away', () => {
  const { response } = captured()
  assert.equal(response.stream, true)
  assert.equal((response.body.sse.match(/^data: /gm) ?? []).length, 3)
})
