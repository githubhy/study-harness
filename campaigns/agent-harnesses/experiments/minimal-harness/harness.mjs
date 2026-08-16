#!/usr/bin/env node
// The control. ~50 lines: a message list, two tools, a loop, a step cap.
//
//   node --env-file=../../../../.env harness.mjs "Create fizzbuzz.js …"
//
// Every shortcut below is marked SHORTCUT and is deliberate. Each one is a
// question a real harness had to answer, and the list of them is what drives
// the dissection order. Do not fix them — they are the experiment.
//
// It runs model-authored shell in the current directory with no confirmation.
// Run it from a scratch directory, never from a repo you care about.

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const API = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const KEY = process.env.DEEPSEEK_API_KEY
const MAX_STEPS = 10 // SHORTCUT: a hard step cap is the only stop condition. → Thread B

if (!KEY) { console.error('DEEPSEEK_API_KEY is not set'); process.exit(1) }

// SHORTCUT: one hardcoded string is the entire system prompt. → Thread A
const SYSTEM = 'You are a coding assistant with shell and file-write tools. '
  + 'Work in the current directory. When the task is done, say so plainly.'

// SHORTCUT: two tools in an array literal, described once, registered nowhere. → Threads D, A
const tools = [
  { type: 'function', function: { name: 'run_command',
      description: 'Run a shell command in the current directory and return its combined output.',
      parameters: { type: 'object', required: ['command'],
        properties: { command: { type: 'string' } } } } },
  { type: 'function', function: { name: 'write_file',
      description: 'Write text to a file, replacing it if it exists.',
      parameters: { type: 'object', required: ['path', 'content'],
        properties: { path: { type: 'string' }, content: { type: 'string' } } } } },
]

// SHORTCUT: no permission gate — whatever the model asks for, runs. → Thread D
// SHORTCUT: execSync on the host, no isolation of any kind. → Thread G
const impls = {
  run_command: ({ command }) => {
    try { return execSync(command, { encoding: 'utf8', stdio: 'pipe' }) || '(no output)' }
    catch (error) { return `command failed: ${error.stderr || error.message}` }
  },
  write_file: ({ path, content }) => { writeFileSync(path, content); return `wrote ${path}` },
}

const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: process.argv[2] }]

for (let step = 1; step <= MAX_STEPS; step++) {
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, tools }),
  })
  if (!res.ok) { console.error(`HTTP ${res.status}: ${await res.text()}`); process.exit(1) }

  const message = (await res.json()).choices?.[0]?.message
  messages.push(message) // SHORTCUT: history only grows; nothing is ever dropped. → Thread C

  if (!message.tool_calls?.length) {
    console.log(message.content) // SHORTCUT: stdout is the whole interface. → Thread K
    process.exit(0)
  }

  for (const call of message.tool_calls) {
    const args = JSON.parse(call.function.arguments)
    console.error(`  · ${call.function.name} ${JSON.stringify(args).slice(0, 90)}`)
    const result = impls[call.function.name](args)
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      // SHORTCUT: the crudest possible compaction — truncate and hope. → Thread C
      content: String(result).slice(0, 4000),
    })
  }
}

console.error(`stopped: hit the ${MAX_STEPS}-step cap with no final answer`)
process.exit(1)
// SHORTCUT: the process exits and every message is gone. → Thread I
