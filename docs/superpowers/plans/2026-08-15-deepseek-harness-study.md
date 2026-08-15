# Agent Harness Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a transferable understanding of agent harnesses as a category, starting from zero, using DeepSeek Harness (`dsh`) as the specimen and Claude Code as the test of whether the understanding transfers.

**Architecture:** Build before you read. Phase 1 is a ~45-line working harness written from scratch — it is the primer, not the finale, because every shortcut it takes is a question that a real harness answers. Phase 2 dissects `dsh` as the answers to those questions, outside-in: capture wire traffic first, read source only to explain what was observed. Phase 4 tests the resulting vocabulary against Claude Code using local session transcripts.

**Tech Stack:** TypeScript, Node.js ≥20, pnpm workspaces, Cordis (plugin/DI framework), Vitest. The toy harness and capture proxy are dependency-free Node against the DeepSeek API (OpenAI-compatible wire format).

**Spec:** `docs/adr/0001-outside-in-study-method.md` records the method and the rejected alternatives. `CONTEXT.md` holds the glossary this plan both consumes and extends.

## Why Phase 1 Builds a Toy First

The toy harness is **the experimental control**, not a training-wheels detour. It is the only harness whose every byte you can fully account for, which makes it the reference against which `dsh`'s captures are read. It should take about an hour.

Its real function is to convert a 49-package monorepo from a wall of unfamiliar code into a list of answers. You cannot ask "why does compaction need its own package?" until your own `.slice(0, 4000)` has eaten a file you needed. Each shortcut in the toy is a question; `notes/01-what-my-harness-lacks.md` is the question list; the Phase 2 menu is the set of answers.

If you want the one-paragraph version of the category before writing it:

> A language model is a function from text to text. It cannot read a file, run a command, or remember anything. A **harness** is the program wrapped around it that supplies all three — it keeps a list of messages, tells the model what tools exist, calls the model, notices when the model asks to use a tool, actually runs the tool, appends the result to the list, and calls the model again. That repetition is the **loop**. Everything else — compaction, permissions, plugins, sandboxing, delegation — is a refinement of one of those five steps.

## Study Thesis

1. **You can't read what you can't name.** Writing a harness first supplies the vocabulary that makes a real one legible. A novice reading `packages/core/agent-loop` cold learns nothing; the same person who has written a loop recognises it instantly.
2. **Wire traffic beats source reading.** Prompt assembly is scattered across many files; the bytes on the wire are single, literal ground truth. When a reading and a capture disagree, the capture wins.
3. **A vocabulary that only explains its own specimen is worthless.** The study succeeds if concepts derived from dsh explain Claude Code, and fails if they don't.

## Global Constraints

- **Upstream is read-only and pinned.** `deepseek-ai/deepseek-harness` at commit `47f943859bef60e4160492346772ded9b24f765a` (branch `master`, 2026-08-13). Every `file:line` citation must resolve at this SHA.
- **Upstream location:** `../deepseek-harness`, a sibling of this repo. Never nested inside it.
- **Only one API key is in play:** `DEEPSEEK_API_KEY`. There is no Anthropic API key — Claude Code here runs on a subscription, so it is studied through **local transcripts**, never through a proxy.
- **Never commit captures.** `captures/` is gitignored and the proxy redacts auth headers at write time. Non-negotiable.
- **Analyse, don't dump.** `dsh`'s system prompt ships in a public MIT repo and may be quoted verbatim. Claude Code transcripts are personal working history — cite structure, counts, and tool names, never paste conversation content. This repo is public.
- **Every source claim cites `path:line`** relative to the upstream root.
- **Vocabulary lands in `CONTEXT.md` immediately**, in the session it sharpens — not at the end.
- **There is no completion criterion.** See the surprise budget.

## The Surprise Budget

This study is open-ended and depth-first. In place of "done":

> **Abandon a thread after two consecutive findings that don't surprise you.**

File it so it isn't lost:

```bash
gh issue create --title "<thread>: <where it went dry>" --label needs-triage \
  --body "Abandoned at <point>. Last two findings were unsurprising: <what they were>. Worth resuming if <condition>."
```

A dry thread is a result, not a failure. When nothing in the `needs-triage` queue is interesting, the study is resting, not finished.

## Phase Map

| Phase | What | Blocked by |
|---|---|---|
| 0 | Scaffold, pin upstream, build the capture proxy | nothing |
| 1 | **Write a harness from scratch** — the primer | Phase 0 |
| 2 | Dissect dsh as answers to Phase 1's questions (**15-thread menu**, any order) | Phase 1 |
| 3 | Exam: one tool in two harnesses | Thread D |
| 4 | Transfer test: does the vocabulary explain Claude Code? | Phase 2 |

Phase 2 is a **menu** — work whichever thread is most interesting, until the surprise budget runs out. Phase 4 is last by design; analysing Claude Code earlier would make the test circular.

## File Structure

| Path | Responsibility |
|---|---|
| `.gitignore` | Excludes `captures/`, `node_modules/`, `.env` |
| `tools/capture-proxy/server.mjs` | Logging reverse proxy |
| `experiments/minimal-harness/harness.mjs` | **Phase 1** — the primer |
| `notes/00-orientation.md` | Pinned SHA, package map, discovered env vars |
| `notes/01-what-my-harness-lacks.md` | Phase 1 output — the question list driving Phase 2 |
| `notes/02-baseline-behavior.md` | Observed dsh behaviour, recorded before reading source |
| `notes/A-*.md` … `notes/O-*.md` | Phase 2 thread outputs — 15 threads covering all 49 `packages/*` directories |
| `experiments/hello-tool-dsh/`, `experiments/hello-tool-mcp/` | Phase 3 |
| `notes/X-transfer-test.md` | Phase 4 |
| `CONTEXT.md` | Glossary; grows continuously |
| `docs/adr/` | Decisions; `0001` records the method |

---

## Phase 0 — Scaffold and Instrument

### Task 0.1: Pin the upstream checkout

**Produces:** `LLM_BASE_URL_ENV` (env var or settings key overriding dsh's model base URL) and `DSH_CMD` (command for a non-interactive run). Later tasks consume these by name.

- [ ] **Step 1: Write `.gitignore`**

```gitignore
captures/
node_modules/
.env
.env.*
*.log
```

- [ ] **Step 2: Clone upstream at the pinned SHA**

```bash
git clone https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness
git -C ../deepseek-harness checkout 47f943859bef60e4160492346772ded9b24f765a
git -C ../deepseek-harness rev-parse HEAD
```

Expected: prints `47f943859bef60e4160492346772ded9b24f765a`. Detached HEAD is intended.

- [ ] **Step 3: Install and build**

```bash
cd ../deepseek-harness
corepack enable
pnpm install --frozen-lockfile
pnpm build 2>&1 | tail -20
```

If `pnpm build` isn't defined, list scripts with `node -e "console.log(Object.keys(require('./package.json').scripts))"`.

- [ ] **Step 4: Verify it runs, and find the base-URL override**

```bash
cd ../deepseek-harness
pnpm dsh --help 2>&1 | head -30
rg -n 'baseURL|baseUrl|base_url|BASE_URL' packages/llm/ apps/ --type ts | head -30
```

Record the working invocation as `DSH_CMD` and the override as `LLM_BASE_URL_ENV`.

- [ ] **Step 5: Write `notes/00-orientation.md` and commit**

Record the pinned SHA, `DSH_CMD`, `LLM_BASE_URL_ENV` with `path:line` evidence, and a one-line guess at each `packages/*` directory's responsibility.

```bash
git add .gitignore notes/00-orientation.md
git commit -m "study: pin upstream at 47f9438 and record orientation"
```

---

### Task 0.2: Build the capture proxy

**Produces:** `captures/session-<label>.jsonl` — one JSON object per line, `dir:"request"`/`dir:"response"`, correlated by `id`.

- [ ] **Step 1: Write the proxy**

Streaming-safe (tees SSE without buffering the client's view) and redacts credentials at write time.

```javascript
// tools/capture-proxy/server.mjs
import { createServer } from 'node:http'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const UPSTREAM = process.env.CAPTURE_UPSTREAM ?? 'https://api.deepseek.com'
const PORT = Number(process.env.CAPTURE_PORT ?? 8899)
const OUT_DIR = process.env.CAPTURE_DIR ?? 'captures'
const LABEL = process.env.CAPTURE_LABEL ?? 'default'

mkdirSync(OUT_DIR, { recursive: true })
const LOG = join(OUT_DIR, `session-${LABEL}.jsonl`)

const SENSITIVE = new Set(['authorization', 'x-api-key', 'api-key', 'cookie'])
const HOP_BY_HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding'])

const redact = (h) =>
  Object.fromEntries(
    Object.entries(h).map(([k, v]) => [k, SENSITIVE.has(k.toLowerCase()) ? '<redacted>' : v]),
  )

const forwardable = (h) =>
  Object.fromEntries(Object.entries(h).filter(([k]) => !HOP_BY_HOP.has(k.toLowerCase())))

const safeJson = (s) => {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

const write = (rec) => appendFileSync(LOG, JSON.stringify(rec) + '\n')

let seq = 0

createServer(async (req, res) => {
  const id = ++seq
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = Buffer.concat(chunks).toString('utf8')

  write({
    id, dir: 'request', ts: new Date().toISOString(),
    method: req.method, url: req.url,
    headers: redact(req.headers), body: safeJson(body),
  })

  let upstream
  try {
    upstream = await fetch(new URL(req.url, UPSTREAM), {
      method: req.method,
      headers: forwardable(req.headers),
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      duplex: 'half',
    })
  } catch (err) {
    write({ id, dir: 'error', ts: new Date().toISOString(), message: String(err) })
    res.writeHead(502).end(String(err))
    return
  }

  res.writeHead(upstream.status, forwardable(Object.fromEntries(upstream.headers)))

  const seen = []
  if (upstream.body) {
    for await (const chunk of upstream.body) {
      seen.push(Buffer.from(chunk))
      res.write(chunk)
    }
  }
  res.end()

  write({
    id, dir: 'response', ts: new Date().toISOString(),
    status: upstream.status, body: Buffer.concat(seen).toString('utf8'),
  })
}).listen(PORT, '127.0.0.1', () =>
  console.log(`capture proxy → ${UPSTREAM} on http://127.0.0.1:${PORT} (log: ${LOG})`),
)
```

- [ ] **Step 2: Verify the redaction guarantee**

```bash
cd /Users/claire/GitRepos/study-harness
CAPTURE_LABEL=smoke node tools/capture-proxy/server.mjs &
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8899/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"
rg -n 'sk-|Bearer' captures/session-smoke.jsonl
```

Expected: a status code (200 or 401 both prove forwarding), then **no matches** from `rg`. If `rg` prints anything, stop and fix `redact()` — a leaked key in a capture is the one unrecoverable mistake in this study.

- [ ] **Step 3: Commit**

```bash
git add tools/capture-proxy/
git commit -m "study: add wire-capture proxy with credential redaction"
```

---

## Phase 1 — Write a Harness From Scratch

**This phase is the primer.** It is deliberately first. You are not trying to build something good — you are trying to earn the vocabulary that makes Phase 2 readable. Every shortcut here is a question dsh answers.

### Task 1.1: The loop

- [ ] **Step 1: Write it**

DeepSeek's API is OpenAI-compatible, so this is the standard function-calling shape.

```javascript
// experiments/minimal-harness/harness.mjs
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const API = process.env.HARNESS_BASE_URL ?? 'https://api.deepseek.com'
const KEY = process.env.DEEPSEEK_API_KEY
const MODEL = 'deepseek-chat'
const MAX_STEPS = 10

const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file from disk.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path to the file.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command and return its combined output.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'The command to run.' } },
        required: ['command'],
      },
    },
  },
]

const impls = {
  read_file: ({ path }) => readFileSync(path, 'utf8'),
  run_command: ({ command }) => execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
}

const messages = [
  { role: 'system', content: 'You are a coding assistant. Use the tools to inspect and run code. Stop when the task is done.' },
  { role: 'user', content: process.argv[2] },
]

for (let step = 1; step <= MAX_STEPS; step++) {
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, tools }),
  })
  const data = await res.json()
  const msg = data.choices?.[0]?.message
  if (!msg) { console.error(JSON.stringify(data, null, 2)); break }
  messages.push(msg)

  if (!msg.tool_calls?.length) {
    console.log(msg.content)
    break
  }

  for (const call of msg.tool_calls) {
    console.error(`  → ${call.function.name}(${call.function.arguments})`)
    let result
    try {
      result = impls[call.function.name](JSON.parse(call.function.arguments))
    } catch (e) {
      result = `ERROR: ${e.message}`
    }
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: String(result).slice(0, 4000), // ← the crudest possible compaction
    })
  }
}
```

- [ ] **Step 2: Run the canonical task**

Use this exact prompt for **every** harness in this study, so runs stay comparable:

```bash
mkdir -p /tmp/toy && cd /tmp/toy
node /Users/claire/GitRepos/study-harness/experiments/minimal-harness/harness.mjs \
  "Create a file called fizzbuzz.js that prints FizzBuzz for 1..20, then run it with node and show me the output."
```

Expected: tool calls printed to stderr, a created file, and a final answer. If it loops without finishing, that is `MAX_STEPS` doing its job — note it.

- [ ] **Step 3: Capture your own harness through the proxy**

```bash
CAPTURE_LABEL=toy node /Users/claire/GitRepos/study-harness/tools/capture-proxy/server.mjs &
HARNESS_BASE_URL=http://127.0.0.1:8899 node .../harness.mjs "<canonical task>"
```

You now have a capture whose every byte you can explain, which is the reference for reading dsh's.

- [ ] **Step 4: Commit**

```bash
git add experiments/minimal-harness/
git commit -m "study: minimal harness from scratch — the primer"
```

### Task 1.2: Write down what it lacks

This note **drives all of Phase 2**. Be specific and be honest about what broke.

- [ ] **Step 1: Break it deliberately**

Run tasks that expose each shortcut, and record what happens:

```bash
# blows the 4000-char truncation
node .../harness.mjs "Read package-lock.json and tell me the top-level dependency names."
# blows MAX_STEPS
node .../harness.mjs "Create 12 files each with a different sorting algorithm, run each, and compare."
# no permission layer at all
node .../harness.mjs "Delete every .tmp file under /tmp."
```

The third should alarm you. That reaction is `packages/guard`'s entire reason to exist.

- [ ] **Step 2: Write `notes/01-what-my-harness-lacks.md`**

One section per shortcut: what the toy does, how it failed, and the question it raises. Then map each to where Phase 2 will answer it:

| Shortcut in the toy | Question it raises | Thread |
|---|---|---|
| `.slice(0, 4000)` on tool results | What should be dropped when context fills, and how is that decided? | C |
| Every tool runs unchecked | Where does a permission boundary belong, and what does it gate? | D |
| Hard-coded `MAX_STEPS = 10` | What legitimately terminates a loop? | B |
| Two tools in an array literal | How does a tool get registered and described at scale? | D, A |
| One hard-coded system prompt string | What actually belongs in a system prompt? | A |
| No plugins, no extension points | Where should a harness's extension boundary sit? | E |

- [ ] **Step 3: Seed `CONTEXT.md`**

You have now earned real definitions for **loop**, **turn**, **step**, **tool call**, **tool result**, and **context window**. Add them in your own words — they will be corrected later, and that correction is data.

- [ ] **Step 4: Commit**

---

## Phase 2 — Dissect dsh

Each thread has a **headline question** inherited from `notes/01-what-my-harness-lacks.md`. Work in any order. Honour the surprise budget.

### Task 2.0: Capture and observe dsh (do this first)

- [ ] **Step 1: Capture the canonical task**

```bash
mkdir -p /tmp/dsh-capture && cd /tmp/dsh-capture
CAPTURE_LABEL=dsh-canonical node /Users/claire/GitRepos/study-harness/tools/capture-proxy/server.mjs &
<LLM_BASE_URL_ENV>=http://127.0.0.1:8899 <DSH_CMD> "<canonical task>"
```

- [ ] **Step 2: Record `notes/02-baseline-behavior.md` before reading any source**

Only what was observable: round-trip count, tools called in order, whether approval was requested and when, what was displayed between steps, whether it verified its own work. Then verify it stayed observational:

```bash
rg -n 'packages/' notes/02-baseline-behavior.md   # expected: no matches
```

- [ ] **Step 3: Diff it against your toy's capture** — same task, two harnesses. Every difference is a thread to pull.

### Thread A — Prompt and tool presentation

> **Headline:** What actually belongs in a system prompt, and how much behaviour is bought with prose rather than code?

**Note:** `notes/A-prompt-and-tools.md` · **Source:** `packages/core/system-prompt`, `packages/core/agent-tool-presentation`

- [ ] Extract and compare against your toy's one-line prompt:

```bash
jq -r 'select(.dir=="request") | .body.messages[] | select(.role=="system") | .content' \
  captures/session-dsh-canonical.jsonl | head -1 > /tmp/dsh-system-prompt.txt
jq -r 'select(.dir=="request") | .body.tools[]? | "\(.function.name)\t\(.function.description | .[0:100])"' \
  captures/session-dsh-canonical.jsonl | sort -u
```

- [ ] Locate the assembly. Take a distinctive six-word phrase from the capture and `rg` for it; if it isn't found literally, it's built from fragments — record which and where.
- [ ] **Answer with a number:** what fraction of behavioural instruction lives in tool *descriptions* versus the system prompt? That ratio is a category-level property.
- [ ] Add resolved terms to `CONTEXT.md`, commit.

### Thread B — The agent loop

> **Headline:** What legitimately terminates a loop? (Your toy used `MAX_STEPS = 10`.)

**Note:** `notes/B-agent-loop.md` · **Source:** `packages/core/agent-loop`

- [ ] Find the loop and mark its five phases — assemble, call, parse, execute, append-and-decide. Confirm your toy has all five.

```bash
cd ../deepseek-harness
rg -n 'while|for await|async function.*[Ll]oop|step|turn' packages/core/agent-loop --type ts | head -30
rg -n 'break|return|maxSteps|maxTurns|stop|finish' packages/core/agent-loop --type ts | head -25
```

- [ ] Record every termination condition in precedence order.
- [ ] Read the tests as executable spec — test names are a specification in prose:

```bash
pnpm vitest run packages/core/agent-loop --reporter=verbose 2>&1 | head -40
```

- [ ] **Reconcile** every observation in `notes/02-baseline-behavior.md` against a specific line, or list it as an open question.
- [ ] Add resolved terms to `CONTEXT.md`, commit.

### Thread C — Context and compaction

> **Headline:** What should be dropped when context fills? (Your toy used `.slice(0, 4000)`.)

**Note:** `notes/C-context-and-compaction.md` · **Source:** `packages/compaction/*`, `packages/context`, `packages/spill`

The densest engineering in the repo, and the direct answer to your toy's worst shortcut. Treat it as the centrepiece.

- [ ] Measure the growth curve:

```bash
jq -r 'select(.dir=="request") | "\(.id)\t\(.body.messages | length)\t\(.body.messages | tostring | length)"' \
  captures/session-dsh-canonical.jsonl
```

- [ ] Force a compaction event with a long task and look for a **drop** in message count.
- [ ] Read the pruner:

```bash
rg -n 'threshold|maxTokens|budget|trigger|shouldCompact' packages/compaction --type ts | head -25
rg -n 'prune|elide|truncat' packages/compaction/compaction-tool-result-pruner --type ts | head -20
```

- [ ] **Answer specifically:** what survives, what doesn't, and is the decision positional, semantic, or size-based? Compare to your `.slice()`.
- [ ] Add resolved terms to `CONTEXT.md`, commit.

### Thread D — Tool vertical slice and the permission boundary

> **Headline:** Where does a permission boundary belong? (Your toy had none, and it deleted files.)

**Note:** `notes/D-tool-vertical-slice.md` · **Source:** `packages/core/tools`, `packages/fs`, `packages/guard`, `packages/web` · **Gates:** Phase 3

- [ ] Trace the file-edit tool through six layers, each cited `path:line`: schema → registration → presentation → dispatch → permission → result serialization.

```bash
rg -n 'edit|write|patch|replace' packages/core/tools packages/fs --type ts -l | head -20
rg -n 'approve|permission|confirm|allow|deny' packages/guard --type ts | head -25
```

- [ ] Confirm the serialized result shape against the capture — if your reading disagrees, the wire wins.
- [ ] Write the checklist **"what a new tool must provide"**, harness-neutral where possible. Phase 3 consumes it.
- [ ] Add resolved terms to `CONTEXT.md`, commit.

### Thread E — Plugin architecture

> **Headline:** Where should a harness's extension boundary sit? (Your toy had none.)

**Note:** `notes/E-plugin-architecture.md` · **Source:** `packages/core/scope`, `packages/boot`

- [ ] Learn Cordis first. Without it the codebase looks like indirection with no call graph — nothing calls anything directly, so grep-based tracing fails. There is a paper: *A Programming Paradigm for Spatiotemporal Composability*.

```bash
cat packages/core/README.md AGENTS.md CLAUDE.md packages/AGENTS.md
rg -n 'ctx\.(plugin|on|set|inject)' packages/core --type ts | head -25
```

- [ ] Trace the plugin lifecycle from `packages/boot` through registration.
- [ ] **Record the cost:** what does "everything is a plugin" make hard that a monolithic core would make easy?
- [ ] Add resolved terms to `CONTEXT.md`, commit.

### Thread F — Delegation, planning, and sub-agents

> **Headline:** When does a harness spawn *another* harness, and what does the child inherit?

**Note:** `notes/F-delegation.md` · **Source:** `packages/subagent`, `packages/plan`, `packages/goal`, `packages/jobs`, `packages/schedule`

Your toy has one loop and one context. Real harnesses fan out — and the design question is what a sub-agent inherits (tools? history? permissions?) and how its result re-enters the parent's context.

- [ ] Map the four packages to roles: is `goal` the objective, `plan` the decomposition, `jobs` the execution, `schedule` the timing? Confirm or correct with `path:line`.
- [ ] Find where a child context is constructed and what is copied vs. shared: `rg -n 'fork|spawn|child|sub.?agent|delegate' packages/plan packages/jobs --type ts | head -25`
- [ ] **Compare directly to Claude Code**, which has the same feature — sub-agent invocations appear in transcripts as `Task`/`Agent` tool calls, and `isSidechain` on transcript records marks child sessions. This is one of the sharpest comparison surfaces in the whole study.
- [ ] Add terms to `CONTEXT.md`, commit.

### Thread G — Execution and sandboxing

> **Headline:** Where does model-authored code actually run, and what contains it?

**Note:** `notes/G-execution-sandbox.md` · **Source:** `packages/sandbox`, `packages/e2b`, `packages/code-runtime`, `packages/shell`, `packages/subprocess`, `packages/terminal`

Your toy called `execSync` on the host with no isolation whatsoever. That dsh has three packages here says the answer is not obvious.

- [ ] Distinguish the three: is `code-runtime` the abstraction, `sandbox` the local implementation, `e2b` a remote provider? Verify.
- [ ] Find the escape-hatch: is there a path where code runs unsandboxed, and what gates it? `rg -n 'unsafe|escape|host|local|bypass' packages/sandbox --type ts | head -20`
- [ ] **Answer the category question:** what are the available isolation strategies (none / subprocess / container / remote VM), and what does each cost in latency and fidelity?
- [ ] Add terms to `CONTEXT.md`, commit.

### Thread H — Interop: MCP and ACP

> **Headline:** When a harness standardises its extension boundary, what does it give up?

**Note:** `notes/H-interop.md` · **Source:** `packages/mcp`, `packages/acp`, `packages/api`, `packages/sdk`

Thread E covers the *native* extension boundary (Cordis plugins). This covers the *standard* one. Both harnesses under study speak MCP, which makes it the one integration surface you can compare directly.

- [ ] Trace an MCP tool from server registration to model presentation, and diff that path against the native plugin path from Thread E. What does the MCP tool lose?
- [ ] Identify `acp` — Agent Client Protocol? Determine what it connects and to whom: `cat packages/acp/README.md`
- [ ] **Answer:** which capabilities can a native plugin express that an MCP server cannot? That gap is why native plugin systems still exist.
- [ ] Add terms to `CONTEXT.md`, commit.

### Thread I — Persistence and resumption

> **Headline:** What must be saved for a harness to resume a conversation it isn't currently holding in memory?

**Note:** `notes/I-persistence.md` · **Source:** `packages/session`, `packages/session-query`, `packages/settings`, `packages/storage`, `packages/workspace`

Your toy loses everything on exit. This is also the thread with the richest comparison data, because Claude Code's own answer is sitting on your disk in 3,800 files.

- [ ] Find dsh's session record shape and where it's written: `rg -n 'persist|save|write|serialize' packages/session --type ts | head -25`
- [ ] Determine what `session-query` exists for — is history searchable, and does the *model* get to search it, or only the user?
- [ ] **Diff against Claude Code's transcript schema**, which you can read directly:

```bash
F=$(find ~/.claude/projects -name '*.jsonl' | head -1)
jq -r '.type' "$F" | sort | uniq -c
jq -r 'select(.type=="system") | keys | join(", ")' "$F" | head -1
```

- [ ] Add terms to `CONTEXT.md`, commit.

### Thread J — Observability, hooks, and cost

> **Headline:** How does a harness let someone outside the loop observe or interrupt it?

**Note:** `notes/J-observability.md` · **Source:** `packages/hooks`, `packages/feedback`, `packages/runtime-diagnostics`, `packages/llm/token-meter`

- [ ] Map the hook points: which loop phases can be intercepted, and can a hook *block* an action or only observe it? `rg -n 'hook|before|after|intercept' packages/hooks --type ts | head -25`
- [ ] Read `token-meter` — where does a harness count tokens, and does it count before sending (budgeting) or after (accounting)? This connects directly to Thread C's compaction trigger.
- [ ] **Compare to Claude Code's hooks**, which appear in transcripts as `hookCount`, `hookErrors`, `hookInfos`, and `preventedContinuation` on `system` records — that last field proves hooks there *can* block.
- [ ] Add terms to `CONTEXT.md`, commit.

### Thread K — The host boundary

> **Headline:** Where does the harness end and the user interface begin?

**Note:** `notes/K-host-boundary.md` · **Source:** `packages/host`, `packages/client`, `packages/interaction`, `apps/`

Your toy printed to stdout. dsh serves a web UI on `127.0.0.1:3080`, which means it has drawn a boundary somewhere — and where that line sits determines whether a harness can be embedded, scripted, or driven headlessly.

- [ ] Determine the transport between core and UI: HTTP, WebSocket, JSON-RPC, or in-process?
- [ ] Find how streaming reaches the UI — is it the raw model stream, or re-emitted domain events?
- [ ] **Answer:** could you drive this harness with no UI at all? What is the minimum surface a headless embedder needs?
- [ ] Add terms to `CONTEXT.md`, commit.

### Thread L — Provider abstraction

> **Headline:** What does it take to make a harness model-agnostic, and where does the abstraction leak?

**Note:** `notes/L-providers.md` · **Source:** `packages/llm/*`, `packages/credentials`, `packages/identity`

Your toy hard-codes DeepSeek's wire format. dsh ships `llm-deepseek` and `llm-pi-ai` behind a shared `llm` interface.

- [ ] Read the shared interface, then both implementations. What is in the interface that only one provider actually needs? That is where the abstraction leaks.
- [ ] Read `llm-retry` — which failures are retried, with what backoff, and is a retried call visible to the loop or hidden beneath it?
- [ ] **Answer the category question:** can a harness be genuinely model-agnostic, given that prompt engineering, tool-call formats, and thinking blocks all differ per model?
- [ ] Add terms to `CONTEXT.md`, commit.

### Thread M — Inputs and code intelligence

> **Headline:** What does a harness feed the model besides text and tool results?

**Note:** `notes/M-inputs.md` · **Source:** `packages/attachment`, `packages/lsp`

- [ ] `attachment`: how are images and files injected, and are they re-sent every turn or referenced? (This has a direct cost consequence — connect it to Thread C.)
- [ ] `lsp`: the harness runs a language server and hands the model its output. Determine whether that arrives as a tool the model calls, or as context injected without being asked.
- [ ] **Answer:** which is better, and why did dsh choose as it did?
- [ ] Add terms to `CONTEXT.md`, commit.

### Thread N — Cross-language embedding

> **Headline:** Can a harness written in TypeScript be driven from another language, and what does that boundary force it to make explicit?

**Note:** `notes/N-embedding.md` · **Source:** `python/`, `packages/sdk`, `packages/native`, `BENCHMARK.md`

`BENCHMARK.md` points at a Python SDK and a `jsonrpc-agent` variant — an RPC boundary usually forces the cleanest statement of what a harness actually *is*, because everything crossing it must be serialisable.

- [ ] Read the Python SDK's surface. What operations does it expose? That list is dsh's own answer to "what is the harness API?"
- [ ] Find the `jsonrpc-agent` variant and read its method list.
- [ ] **Answer:** compare that RPC surface to your toy's function signatures. What did dsh have to make explicit that you left implicit?
- [ ] Add terms to `CONTEXT.md`, commit.

### Thread O — Agent self-management

> **Headline:** What tools does a harness give the model for managing *its own process*, rather than the user's task?

**Note:** `notes/O-self-management.md` · **Source:** `packages/todo`, `packages/skill`, `packages/workflow`

A distinct category of tool that your toy has no concept of: the model tracking its own plan, loading its own instructions, and running predefined procedures. Every one of these has a direct Claude Code analogue, making this the densest comparison surface in the study.

- [ ] **`todo`** — the model maintains a task list the user can see. Determine whether the list is context (re-sent every turn, costing tokens) or external state (stored, referenced). That choice is the whole design question. Compare to Claude Code's `TodoWrite`, visible in your transcripts.
- [ ] **`skill`** — packaged instructions loaded on demand. Find the trigger: does the model request a skill by name, or does the harness inject one based on matching? Compare to Claude Code's `Skill` tool and its skill listings.
- [ ] **`workflow`** — determine what distinguishes a workflow from a plan (Thread F) and from a skill. If the distinction isn't clear from the code, that ambiguity is itself the finding.
- [ ] **Answer the category question:** is self-management better expressed as tools the model calls, or as harness machinery the model never sees? Both harnesses chose tools — find out what that costs.
- [ ] Add terms to `CONTEXT.md`, commit.

### Optional Thread — Claude Code wire capture

Not recommended, and not needed for any other thread. Claude Code here runs on a subscription, so `ANTHROPIC_BASE_URL` would route OAuth-authenticated traffic through the local proxy. It may simply not work, and it is not required — Threads F, I, and J each get their Claude Code comparison from transcripts instead. Listed only so the omission is a decision rather than an oversight. If you do try it, the proxy already redacts credentials before writing, and the analyse-don't-dump constraint still applies.

### Package Coverage

Breadth is checkable, and this table is **verified against all 49 `packages/*` directories** at the pinned SHA:

| Thread | Packages |
|---|---|
| A | `core/system-prompt`, `core/agent-tool-presentation`, `preset` |
| B | `core/agent-loop`, `core/agent`, `core/agent-default-model` |
| C | `compaction/*`, `context`, `core/session`, `spill` |
| D | `core/tools`, `fs`, `guard`, `web` |
| E | `core/scope`, `boot`, `extensions`, `bundle` |
| F | `subagent`, `plan`, `goal`, `jobs`, `schedule` |
| G | `sandbox`, `e2b`, `code-runtime`, `shell`, `subprocess`, `terminal` |
| H | `mcp`, `acp`, `api`, `sdk` |
| I | `session`, `session-query`, `settings`, `storage`, `workspace` |
| J | `hooks`, `feedback`, `runtime-diagnostics`, `llm/token-meter` |
| K | `host`, `client`, `interaction`, `apps/` |
| L | `llm/llm`, `llm/llm-deepseek`, `llm/llm-pi-ai`, `llm/llm-retry`, `credentials`, `identity` |
| M | `attachment`, `lsp` |
| N | `python/`, `native/`, `examples`, `sdk` |
| O | `todo`, `skill`, `workflow` |
| — | `util`, `typert`, `test-support` — shared infrastructure, deliberately out of scope |

Re-run the check after any upstream bump:

```bash
gh api repos/deepseek-ai/deepseek-harness/contents/packages \
  --jq '.[] | select(.type=="dir") | .name' | sort > /tmp/pkgs.txt
while read -r p; do rg -q "\`[a-z/]*${p}[\`/]" <this-file> || echo "UNCOVERED: $p"; done < /tmp/pkgs.txt
```

If a package isn't listed, that is a gap in the plan — add a thread rather than skipping it.

---

## Phase 3 — Exam: One Tool, Two Harnesses

> **Gates on:** Thread D's checklist

The same trivial tool integrated into both dsh and Claude Code. **The diff between the two integrations is the finding** — what both demand is essential to the category; what only one demands is incidental.

- [ ] **Step 1: As a dsh plugin** — `experiments/hello-tool-dsh/`. Tool `hello_study`, one string parameter, returns the literal marker `STUDY-MARKER-7f3a`. Find the smallest existing tool plugin in the repo and copy its shape exactly; do not invent structure.

```typescript
// experiments/hello-tool-dsh/src/index.ts
import type { Context } from 'cordis'

export const name = 'hello-study'

export function apply(ctx: Context) {
  // ↓ Replace `ctx.tool` with the registration method Thread E revealed.
  ctx.tool({
    name: 'hello_study',
    description: 'A study probe. Returns a fixed marker string for the given word.',
    parameters: {
      type: 'object',
      properties: { word: { type: 'string', description: 'Any word to echo back.' } },
      required: ['word'],
    },
    async execute({ word }: { word: string }) {
      return `STUDY-MARKER-7f3a received:${word}`
    },
  })
}
```

- [ ] **Step 2: As an MCP server** — `experiments/hello-tool-mcp/`, using `@modelcontextprotocol/sdk`. Identical name, parameters, and marker. Register it with Claude Code via `.mcp.json`.

- [ ] **Step 3: Verify both round trips close.** For dsh, from the capture; for Claude Code, from the transcript. Two things must be true each time — the tool was *offered*, and the model *called* it:

```bash
# dsh: offered, then called
jq -r 'select(.dir=="request") | .body.tools[]? | .function.name' captures/session-plugin.jsonl | sort -u | rg hello_study
rg -c 'STUDY-MARKER-7f3a' captures/session-plugin.jsonl

# Claude Code: called (transcripts record invocations, not schemas)
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | .name' \
  ~/.claude/projects/-Users-claire-GitRepos-study-harness/*.jsonl | rg hello_study
```

- [ ] **Step 4: Write the diff** into `notes/D-tool-vertical-slice.md`. The intersection is the category model of "a tool"; note that MCP is itself an answer to "where should the extension boundary sit" — compare it to Cordis plugins.
- [ ] **Step 5: Commit**

---

## Phase 4 — Transfer Test

> **Headline:** Does a vocabulary derived from dsh explain a harness it wasn't derived from?

**Note:** `notes/X-transfer-test.md` · **Source:** `~/.claude/projects/*/*.jsonl` (3,800+ local sessions)

No API key is needed and no proxy is involved — Claude Code runs on a subscription here, and its own session transcripts are already on disk. **Know the limits of this source:** transcripts record `tool_use` blocks, tool names, `permission-mode` records, `stopReason`, and hook invocations. They do **not** record the system prompt or tool schemas. So this tests your model of the *loop, tools, and permissions* — not of prompt assembly.

- [ ] **Step 1: Predict before looking.** From the dsh-derived model alone, write down and **commit**: which tools you expect, how tool results appear to be serialized, what you expect `stopReason` values to be, how permissions appear to be gated. A prediction made after the fact tests nothing.

- [ ] **Step 2: Score the predictions against real data**

```bash
D=~/.claude/projects
# tool vocabulary
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | .name' $D/*/*.jsonl 2>/dev/null | sort | uniq -c | sort -rn | head -25
# content block types — note `thinking` as a block your toy has no concept of
jq -r 'select(.type=="assistant") | .message.content[]? | .type' $D/*/*.jsonl 2>/dev/null | sort | uniq -c
# termination and permission vocabulary
jq -r 'select(.type=="system") | .stopReason // empty' $D/*/*.jsonl 2>/dev/null | sort | uniq -c
jq -r 'select(.type=="permission-mode") | .mode // empty' $D/*/*.jsonl 2>/dev/null | sort | uniq -c
```

- [ ] **Step 3: Classify every term in `CONTEXT.md`** into three buckets — **universal** (explains both), **dsh-specific** (an implementation detail you mistook for a category concept), **missing** (Claude Code does something your vocabulary can't name — `thinking` blocks, hooks, and sidechains are likely candidates). Buckets two and three are the study's real output.

- [ ] **Step 4: Rewrite `CONTEXT.md`** keeping only universal terms as canonical, dsh-specific ones clearly marked.

- [ ] **Step 5: Commit and push.** Cite structure, counts, and tool names only — never transcript content. This repo is public.

---

## Notes on Adapting This Plan

Threads name `packages/*` directories confirmed to exist at the pinned SHA; the files inside are discovered during execution. Where a step says "record it as `X`", that value is a real deliverable consumed by name later — deliberate, not a placeholder.

If an `rg` command returns nothing, that is a finding: the concept is named differently here than expected. Record the actual name and move on.

If a thread runs dry, honour the surprise budget — file the issue and pick another. Grinding a dry seam because it's next in the document is exactly what this structure exists to prevent.
