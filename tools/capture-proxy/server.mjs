#!/usr/bin/env node
// Capture proxy — sits between a harness and its model API, tees every exchange
// to a JSONL file, and forwards bytes to the client without buffering them.
//
//   CAPTURE_UPSTREAM=https://api.deepseek.com \
//   CAPTURE_FILE=campaigns/agent-harnesses/captures/session.jsonl \
//   node tools/capture-proxy/server.mjs
//
// Then point the harness at it:  export DEEPSEEK_BASE_URL=http://127.0.0.1:8787
//
// Credentials are redacted BEFORE the write, never after. A capture file that
// has ever held a key is compromised, because it existed on disk in that state.

import { createServer } from 'node:http'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const PORT = Number(process.env.CAPTURE_PORT ?? 8787)
const UPSTREAM = (process.env.CAPTURE_UPSTREAM ?? 'https://api.deepseek.com').replace(/\/$/, '')
const FILE = process.env.CAPTURE_FILE ?? 'captures/session.jsonl'

/**
 * Header names whose values never reach disk. Compared lowercased, which is
 * safe because Node lowercases incoming header names and we lowercase the
 * upstream response's names ourselves.
 */
const SENSITIVE = new Set([
  'authorization',
  'x-api-key',
  'api-key',
  'cookie',
  'set-cookie',
  'proxy-authorization',
])

/** Replace sensitive values with a marker, keeping the name so the shape stays legible. */
const redact = (headers) =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) =>
      SENSITIVE.has(name.toLowerCase()) ? [name, '<redacted>'] : [name, value],
    ),
  )

mkdirSync(dirname(FILE), { recursive: true })
const record = (entry) => appendFileSync(FILE, `${JSON.stringify(entry)}\n`)

/** Parse a JSON body, or keep the raw text when it is not JSON — never throw mid-request. */
const parseBody = (text, contentType) => {
  if (!text) return null
  if (!/json/i.test(contentType ?? '')) return { raw: text }
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text, parseError: true }
  }
}

let sequence = 0

const server = createServer(async (req, res) => {
  const id = String(++sequence)
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const requestText = Buffer.concat(chunks).toString('utf8')

  record({
    id,
    dir: 'request',
    ts: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: redact(req.headers),
    body: parseBody(requestText, req.headers['content-type']),
  })

  // `host` names this proxy, not the upstream; forwarding it breaks TLS routing.
  const forwarded = { ...req.headers }
  delete forwarded.host
  delete forwarded['content-length']

  let upstream
  try {
    upstream = await fetch(`${UPSTREAM}${req.url}`, {
      method: req.method,
      headers: forwarded,
      body: requestText === '' ? undefined : requestText,
    })
  } catch (error) {
    record({ id, dir: 'error', ts: new Date().toISOString(), message: String(error) })
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'capture-proxy: upstream unreachable', detail: String(error) }))
    return
  }

  const responseHeaders = Object.fromEntries(
    [...upstream.headers].map(([name, value]) => [name.toLowerCase(), value]),
  )
  res.writeHead(upstream.status, redact(responseHeaders))

  // Forward each chunk the moment it arrives, keeping our own copy alongside.
  // The client's view is never delayed by the capture.
  const seen = []
  if (upstream.body) {
    const reader = upstream.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
      seen.push(Buffer.from(value))
    }
  }
  res.end()

  const responseText = Buffer.concat(seen).toString('utf8')
  const isStream = /event-stream/i.test(responseHeaders['content-type'] ?? '')

  record({
    id,
    dir: 'response',
    ts: new Date().toISOString(),
    status: upstream.status,
    headers: redact(responseHeaders),
    stream: isStream,
    // An SSE body is a transcript of frames, not one document; keeping the raw
    // text preserves frame boundaries that a parse would discard.
    body: isStream ? { sse: responseText } : parseBody(responseText, responseHeaders['content-type']),
  })
})

server.listen(PORT, '127.0.0.1', () => {
  process.stderr.write(
    `capture-proxy: 127.0.0.1:${PORT} -> ${UPSTREAM}, writing ${FILE}\n` +
      `capture-proxy: export DEEPSEEK_BASE_URL=http://127.0.0.1:${PORT}\n`,
  )
})
