#!/usr/bin/env node
// Fails if a capture contains a credential. Replaces `rg -n 'sk-|Bearer'`, which
// cries wolf: "sk-" appears inside ordinary words — ask-user, task-runner,
// risk-model — and this campaign reads a codebase full of them. A check that
// fires on `tool-ask-user` teaches you to ignore it, and then it is worth less
// than nothing.
//
//   node tools/capture-proxy/leak-check.mjs <capture.jsonl>...
//
// Two independent checks, because they fail in different ways:
//
//   1. Structural — every sensitive header must read exactly '<redacted>'.
//      Catches a redaction bug even for a credential format nobody anticipated.
//   2. Shape — key-like strings anywhere in the file, including bodies, where a
//      model may have echoed a secret the proxy never saw as a header.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every capture under `campaigns/&ast;/captures`, so the bare command checks something.
 *
 * With no arguments this script used to scan nothing and print "clean: 0 captures" — a pass that
 * proved only that it had been run. It was invoked that way repeatedly during this campaign and
 * reported clean every time, against captures it never opened. A check that cannot fail is worse
 * than no check, and this is the one check whose false pass is unrecoverable.
 */
function defaultTargets() {
  const root = 'campaigns'
  if (!existsSync(root)) return []
  const found = []
  for (const campaign of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(root, campaign.name, 'captures')
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.jsonl')) found.push(join(dir, name))
    }
  }
  return found
}

const SENSITIVE = new Set([
  'authorization', 'x-api-key', 'api-key', 'cookie', 'set-cookie', 'proxy-authorization',
])

/**
 * A credential is a prefix or keyword followed by a long unbroken run of token
 * characters. The length floor is what separates a real key from the "sk-" in
 * "ask-user": prose puts a space or a slash in long before 16 characters.
 */
const PATTERNS = [
  [/\bsk-[A-Za-z0-9]{16,}/g, 'OpenAI/DeepSeek-style key'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{16,}/g, 'bearer token'],
  [/\bghp_[A-Za-z0-9]{20,}/g, 'GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{16,}/g, 'Slack token'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AWS access key id'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'private key block'],
]

const problems = []

const targets = process.argv.length > 2 ? process.argv.slice(2) : defaultTargets()

for (const file of targets) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    problems.push(`${file}: cannot read — ${error.message}`)
    continue
  }

  text.split('\n').forEach((line, index) => {
    if (!line.trim()) return
    const where = `${file}:${index + 1}`

    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      problems.push(`${where}: not valid JSON — a capture must stay machine-readable`)
      return
    }

    for (const [name, value] of Object.entries(entry.headers ?? {})) {
      if (SENSITIVE.has(name.toLowerCase()) && value !== '<redacted>') {
        problems.push(`${where}: header '${name}' was written unredacted`)
      }
    }

    for (const [pattern, label] of PATTERNS) {
      const hits = line.match(pattern)
      if (hits) problems.push(`${where}: ${label} (${hits.length} occurrence${hits.length > 1 ? 's' : ''})`)
    }
  })
}

if (problems.length > 0) {
  console.error('LEAK — do not commit, and treat the key as burned:')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exitCode = 1
} else if (targets.length === 0) {
  // Nothing scanned is not a pass. Exiting 0 here is how this check spent a whole campaign
  // reporting clean without opening a file.
  console.error('leak-check: no captures found to check — refusing to report clean')
  process.exitCode = 1
} else {
  console.log(`clean: ${targets.length} capture${targets.length === 1 ? '' : 's'} checked, no credential found`)
}
