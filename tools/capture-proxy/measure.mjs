#!/usr/bin/env node
// Extracts the facts a note cites from the captures it cites them from, so a
// number appears in exactly one place.
//
//   node tools/capture-proxy/measure.mjs campaigns/agent-harnesses
//
// Captures are gitignored — they can be large and they hold whatever the model
// said — so the *derived* numbers are committed instead, small and reviewable.
// The build reads `measurements.json` and never needs the captures; the check
// re-derives from them when they happen to be present.
//
// Only facts live here. Interpretation stays in the note's prose, where a human
// wrote it and a human is accountable for it.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** Length of a message's content, whatever shape the content takes. */
const contentBytes = (message) =>
  typeof message?.content === 'string' ? message.content.length
    : message?.content == null ? 0
    : JSON.stringify(message.content).length

/**
 * Tool-result sizes must be read from the LAST request, where each appears
 * exactly once. Counting across every request multiplies them by how often the
 * conversation was re-sent — the growth these notes are about is precisely what
 * inflates the count, so the naive reading is wrong in the direction that
 * flatters the finding.
 */
export function measureCapture(text) {
  const lines = text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const requests = lines.filter((l) => l.dir === 'request' && Array.isArray(l.body?.messages))
  if (requests.length === 0) return null

  const first = requests[0]
  const last = requests[requests.length - 1]
  const system = first.body.messages.find((m) => m.role === 'system')

  return {
    requests: requests.length,
    contextBytes: requests.map((r) => JSON.stringify(r.body.messages).length),
    messageCounts: requests.map((r) => r.body.messages.length),
    systemPromptBytes: system ? contentBytes(system) : 0,
    toolsOffered: first.body.tools?.length ?? 0,
    toolResultSizes: last.body.messages.filter((m) => m.role === 'tool').map(contentBytes),
    firstRequestRoles: first.body.messages.map((m) => m.role),
    firstRequestBytes: first.body.messages.map(contentBytes),
    models: [...new Set(requests.map((r) => r.body.model).filter(Boolean))],
    streamed: requests.every((r) => r.body.stream === true),
  }
}

/** Every capture in a campaign, keyed by its file's stem minus the `session-` prefix. */
export function measureCampaign(dir) {
  const capturesDir = join(dir, 'captures')
  if (!existsSync(capturesDir)) return { captures: {} }
  const captures = {}
  for (const name of readdirSync(capturesDir).filter((n) => n.endsWith('.jsonl')).sort()) {
    const key = name.replace(/^session-/, '').replace(/\.jsonl$/, '')
    const measured = measureCapture(readFileSync(join(capturesDir, name), 'utf8'))
    if (measured) captures[key] = { source: `captures/${name}`, ...measured }
  }
  return { captures }
}

/**
 * Resolve `@capture.field` or `@capture.field.index` against a measurements
 * document. Throws rather than returning undefined: a chart that quietly draws
 * nothing is worse than a build that stops.
 */
export function resolveMeasure(reference, measurements) {
  const path = reference.replace(/^@/, '').split('.')
  const [capture, field, index] = path
  const source = measurements?.captures?.[capture]
  if (!source) throw new Error(`measure: no capture "${capture}" — have: ${Object.keys(measurements?.captures ?? {}).join(', ') || 'none'}`)
  if (!(field in source)) throw new Error(`measure: capture "${capture}" has no field "${field}"`)
  const value = source[field]
  if (index === undefined) return value
  const at = Number(index)
  if (!Array.isArray(value) || !Number.isInteger(at) || value[at] === undefined) {
    throw new Error(`measure: "${reference}" does not resolve to a value`)
  }
  return value[at]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]
  if (!dir) {
    console.error('usage: node tools/capture-proxy/measure.mjs <campaign-dir>')
    process.exitCode = 1
  } else {
    process.stdout.write(`${JSON.stringify(measureCampaign(dir), null, 2)}\n`)
  }
}
