# Agent Harness Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a transferable understanding of agent harnesses as a category, using DeepSeek Harness (`dsh`) as the specimen, and prove it transfers by explaining a harness the vocabulary wasn't derived from.

**Architecture:** Outside-in. Capture wire traffic first; read source only to explain what was already observed. `dsh` is dissected to build the vocabulary; Claude Code is the transfer test, not a baseline. Phase 0 is sequential and mandatory; Phase 1 is a menu worked depth-first in any order; Phases 2–3 are the exams and the transfer test.

**Tech Stack:** TypeScript, Node.js ≥20, pnpm workspaces, Cordis (plugin/DI framework), Vitest. Capture tooling is dependency-free Node (`node:http` + built-in `fetch`).

**Spec:** `docs/adr/0001-outside-in-study-method.md` records the method and the rejected alternatives. `CONTEXT.md` holds the glossary this plan both consumes and extends.

## Study Thesis

A harness is one loop: assemble context → call model → parse tool calls → execute → append results → repeat until stop. Everything else is decoration hanging off that loop. Three claims drive the structure:

1. **Wire traffic beats source reading.** Prompt assembly is scattered across many files; the bytes on the wire are single, literal ground truth. When a reading and a capture disagree, the capture wins.
2. **Read vertically, not horizontally.** One complete path through every layer teaches more than each layer surveyed across all features.
3. **A vocabulary that only explains its own specimen is worthless.** The study succeeds if concepts derived from dsh explain Claude Code, and fails if they don't.

## Global Constraints

- **Upstream is read-only and pinned.** `deepseek-ai/deepseek-harness` at commit `47f943859bef60e4160492346772ded9b24f765a` (branch `master`, 2026-08-13). Never commit to it, never update mid-study — every `file:line` citation must resolve at this SHA.
- **Upstream location:** `../deepseek-harness`, a sibling of this repo. Never nested inside it.
- **Never commit captures.** `captures/` is gitignored and the proxy redacts auth headers at write time. Non-negotiable.
- **Analyse, don't dump.** `dsh`'s system prompt ships in a public MIT repo and may be quoted verbatim. Claude Code's has not been published — describe its structure and behaviour, never commit its text. This repo is public.
- **Every source claim cites `path:line`** relative to the upstream root, e.g. `packages/core/agent-loop/src/index.ts:142`.
- **Vocabulary lands in `CONTEXT.md` immediately.** When a thread names a concept precisely, add it to the glossary that session — not at the end.
- **There is no completion criterion.** See the surprise budget below.

## The Surprise Budget

This study is open-ended and depth-first. In place of "done":

> **Abandon a thread after two consecutive findings that don't surprise you.**

When you abandon one, file it so it isn't lost:

```bash
gh issue create --title "<thread>: <where it went dry>" --label needs-triage \
  --body "Abandoned at <point>. Last two findings were unsurprising: <what they were>. Worth resuming if <condition>."
```

A dry thread is a result, not a failure. The `needs-triage` queue is the backlog; when nothing in it is interesting, the study is resting, not finished.

## How To Use This Plan

**Phase 0 is sequential and mandatory** — every thread depends on the instrument. **Phase 1 is a menu.** Pick whichever thread is most interesting, work it until the surprise budget runs out, then pick another. **Phase 2 exams gate on Phase 1** only loosely: Exam 1 needs Thread D, Exam 2 needs Threads A–C. **Phase 3 is last** by design — analysing Claude Code before the vocabulary exists defeats the transfer test.

## File Structure

Created in **this** repo:

| Path | Responsibility |
|---|---|
| `.gitignore` | Excludes `captures/`, `node_modules/`, `.env` |
| `tools/capture-proxy/server.mjs` | Logging reverse proxy — the instrument everything depends on |
| `tools/capture-proxy/README.md` | How to run a capture session against either harness |
| `notes/00-orientation.md` | Pinned SHA, package map, discovered env vars |
| `notes/01-baseline-behavior.md` | Observed dsh behaviour, recorded before reading source |
| `notes/A-prompt-and-tools.md` | Thread A output |
| `notes/B-agent-loop.md` | Thread B output |
| `notes/C-context-and-compaction.md` | Thread C output |
| `notes/D-tool-vertical-slice.md` | Thread D output |
| `notes/E-plugin-architecture.md` | Thread E output |
| `notes/X-transfer-test.md` | Phase 3 — does the vocabulary explain Claude Code? |
| `experiments/hello-tool-dsh/` | Exam 1a — the tool as a dsh plugin |
| `experiments/hello-tool-mcp/` | Exam 1b — the same tool as an MCP server |
| `experiments/minimal-harness/` | Exam 2 — a harness from scratch |
| `CONTEXT.md` | Glossary; grows continuously |
| `docs/adr/` | Decisions; `0001` records the method |

Read-only in `../deepseek-harness`:

| Path | Thread |
|---|---|
| `packages/core/system-prompt`, `packages/core/agent-tool-presentation` | A |
| `packages/core/agent-loop` | B |
| `packages/compaction/*`, `packages/core/session` | C |
| `packages/core/tools`, `packages/fs`, `packages/guard` | D |
| `packages/core/scope`, `packages/boot` | E |
| `packages/llm/llm-deepseek` | Phase 0 (base URL) |

---

## Phase 0 — Build the Instrument

Sequential. Nothing else works until this does.

### Task 0.1: Pin the upstream checkout and scaffold

**Files:**
- Create: `.gitignore`, `notes/00-orientation.md`
- Clone (outside repo): `../deepseek-harness`

**Interfaces:**
- Produces: `LLM_BASE_URL_ENV` (the env var or settings key overriding the model API base URL) and `DSH_CMD` (the command starting a non-interactive run). Named deliverables — every later capture task consumes them.

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

If `pnpm build` isn't defined, list what is with `node -e "console.log(Object.keys(require('./package.json').scripts))"` and use the build-equivalent. Record what worked.

- [ ] **Step 4: Verify the harness runs**

```bash
cd ../deepseek-harness
pnpm dsh --help 2>&1 | head -30
```

If `pnpm dsh` isn't wired, find the binary across `apps/*/package.json`. Record the working invocation as `DSH_CMD`.

- [ ] **Step 5: Discover the base-URL override**

```bash
cd ../deepseek-harness
rg -n 'baseURL|baseUrl|base_url|BASE_URL' packages/llm/ apps/ --type ts | head -30
rg -n 'process\.env\.[A-Z_]+' packages/llm/ --type ts -o | sort -u | head -30
```

Record as `LLM_BASE_URL_ENV`. If it's a settings-file key rather than an env var, record the file path and key path instead.

- [ ] **Step 6: Write `notes/00-orientation.md`**

```markdown
# 00 — Orientation

**Pinned SHA:** 47f943859bef60e4160492346772ded9b24f765a (master, 2026-08-13)
**Upstream path:** ../deepseek-harness

## How to run
- Build: <command that worked>
- DSH_CMD: <command that worked>

## Base URL override
- LLM_BASE_URL_ENV: <env var or settings key>
- Evidence: <path:line>

## Package map
<one line per packages/* dir: name — one-sentence guess at responsibility>
```

- [ ] **Step 7: Commit**

```bash
git add .gitignore notes/00-orientation.md
git commit -m "study: pin upstream at 47f9438 and record orientation"
```

---

### Task 0.2: Build the capture proxy

**Files:**
- Create: `tools/capture-proxy/server.mjs`, `tools/capture-proxy/README.md`

**Interfaces:**
- Produces: `captures/session-<label>.jsonl` — one JSON object per line, `dir:"request"` / `dir:"response"`, correlated by `id`. Every thread reads this. Parameterised by `CAPTURE_UPSTREAM`, so it works against **any** harness, not just dsh.

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
    id,
    dir: 'request',
    ts: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: redact(req.headers),
    body: safeJson(body),
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
    id,
    dir: 'response',
    ts: new Date().toISOString(),
    status: upstream.status,
    body: Buffer.concat(seen).toString('utf8'),
  })
}).listen(PORT, '127.0.0.1', () =>
  console.log(`capture proxy → ${UPSTREAM} on http://127.0.0.1:${PORT} (log: ${LOG})`),
)
```

- [ ] **Step 2: Verify the redaction guarantee**

```bash
cd /Users/claire/GitRepos/study-harness
CAPTURE_LABEL=smoke CAPTURE_UPSTREAM=https://api.anthropic.com node tools/capture-proxy/server.mjs &
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8899/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"
rg -n 'sk-ant|Bearer' captures/session-smoke.jsonl
```

Expected: a status code (200 or 401 both prove forwarding), then **no matches** from `rg`. If `rg` prints anything, stop and fix `redact()` — a leaked key in a capture is the one unrecoverable mistake in this study.

- [ ] **Step 3: Write the README**

`tools/capture-proxy/README.md` documents the four env vars, both upstreams (`https://api.deepseek.com`, `https://api.anthropic.com`), the redaction guarantee, and the `jq` recipes used by the threads.

- [ ] **Step 4: Commit**

```bash
git add tools/capture-proxy/
git commit -m "study: add harness-agnostic wire-capture proxy with credential redaction"
```

---

### Task 0.3: Bank a Claude Code capture (do this early)

Claude Code is capturable **today** with the key already on this machine. Capture now, analyse in Phase 3 — collecting data early doesn't contaminate a vocabulary built later.

**Interfaces:**
- Produces: `captures/session-cc-canonical.jsonl`, consumed only by Phase 3.

- [ ] **Step 1: Define the canonical task**

Use this exact prompt for **every** harness in this study, so captures are comparable:

```
Create a file called fizzbuzz.js that prints FizzBuzz for 1..20,
then run it with node and show me the output.
```

- [ ] **Step 2: Capture Claude Code**

```bash
mkdir -p /tmp/cc-capture && cd /tmp/cc-capture
CAPTURE_LABEL=cc-canonical CAPTURE_UPSTREAM=https://api.anthropic.com \
  node /Users/claire/GitRepos/study-harness/tools/capture-proxy/server.mjs &
ANTHROPIC_BASE_URL=http://127.0.0.1:8899 claude -p "Create a file called fizzbuzz.js that prints FizzBuzz for 1..20, then run it with node and show me the output."
```

- [ ] **Step 3: Verify the capture is real, then stop looking**

```bash
cd /Users/claire/GitRepos/study-harness
jq -r 'select(.dir=="request") | (.body.tools // []) | length' captures/session-cc-canonical.jsonl | head -3
```

Expected: a non-zero tool count. **Do not read the contents yet.** Reading Claude Code's prompt now would seed the vocabulary with Claude-Code-shaped concepts and destroy the transfer test. Bank it and move on.

---

### Task 0.4: Capture dsh

Requires the DeepSeek API key. If it hasn't arrived, skip ahead — Threads B, D, and E are source-only and need no capture.

- [ ] **Step 1: Capture the canonical task**

```bash
mkdir -p /tmp/dsh-capture && cd /tmp/dsh-capture
CAPTURE_LABEL=dsh-canonical CAPTURE_UPSTREAM=https://api.deepseek.com \
  node /Users/claire/GitRepos/study-harness/tools/capture-proxy/server.mjs &
<LLM_BASE_URL_ENV>=http://127.0.0.1:8899 <DSH_CMD> "Create a file called fizzbuzz.js that prints FizzBuzz for 1..20, then run it with node and show me the output."
```

- [ ] **Step 2: Record baseline behaviour before reading any source**

Write `notes/01-baseline-behavior.md` answering only what was observable: how many round-trips, which tools in what order, was approval requested and when, what was displayed between steps, did it verify its own work.

- [ ] **Step 3: Verify the note is observation-only**

```bash
rg -n 'packages/' notes/01-baseline-behavior.md
```

Expected: no matches. This note is the control that Thread B must later reconcile against.

- [ ] **Step 4: Commit**

```bash
git add notes/01-baseline-behavior.md
git commit -m "study: baseline behavioral observation of dsh"
```

---

## Phase 1 — Threads (work in any order, depth-first)

Each thread has a **headline question**. The thread is finished when it answers that question, or abandoned when the surprise budget runs out. Add terms to `CONTEXT.md` as they sharpen.

### Thread A — Prompt and tool presentation

> **Headline question:** How much of a harness's behaviour is bought with prompt text rather than code?

**Needs:** `captures/session-dsh-canonical.jsonl` · **Note:** `notes/A-prompt-and-tools.md`

- [ ] **Extract the system prompt and tool inventory**

```bash
jq -r 'select(.dir=="request") | .body.messages[] | select(.role=="system") | .content' \
  captures/session-dsh-canonical.jsonl | head -1 > /tmp/dsh-system-prompt.txt
jq -r 'select(.dir=="request") | .body.tools[]? | "\(.function.name)\t\(.function.description | .[0:100])"' \
  captures/session-dsh-canonical.jsonl | sort -u
```

- [ ] **Locate the assembly in source**

```bash
cd ../deepseek-harness
rg -n 'You are|<system|systemPrompt' packages/core/system-prompt --type ts | head -20
rg -n 'description|parameters|toJSON|schema' packages/core/agent-tool-presentation --type ts | head -20
```

Take a distinctive six-word phrase from the captured prompt and `rg` for it. If it isn't found literally, it's assembled from fragments — record which, and where.

- [ ] **Answer the headline question with a number**

Quantify the split: how many bytes of behavioural instruction live in tool *descriptions* versus the system prompt? This ratio is a category-level property worth carrying to every other harness.

- [ ] **Add resolved terms to `CONTEXT.md`, then commit**

### Thread B — The agent loop

> **Headline question:** What are the irreducible phases of a harness loop, and what stops it?

**Needs:** `notes/01-baseline-behavior.md` (source-only otherwise) · **Note:** `notes/B-agent-loop.md`

- [ ] **Locate the loop and mark its five phases**

```bash
cd ../deepseek-harness
ls -R packages/core/agent-loop | head -30
rg -n 'while|for await|async function.*[Ll]oop|step|turn' packages/core/agent-loop --type ts | head -30
```

Mark the line where each happens: assemble context, call model, parse tool calls, execute tools, append and decide. Every harness has all five — that's the claim to test.

- [ ] **Find every termination condition**

```bash
rg -n 'break|return|maxSteps|maxTurns|stop|finish' packages/core/agent-loop --type ts | head -25
```

Record all of them in precedence order — no tool calls emitted, step cap, token budget, user interrupt.

- [ ] **Read the tests as executable spec**

```bash
cd ../deepseek-harness
pnpm vitest run packages/core/agent-loop --reporter=verbose 2>&1 | head -40
```

Test names are a specification in prose. An invariant you wouldn't have predicted marks a gap in your model.

- [ ] **Reconcile against the baseline**

Every observation in `notes/01-baseline-behavior.md` must be explained by a specific line, or listed as an open question. This is why the baseline was written first.

- [ ] **Add resolved terms to `CONTEXT.md`, then commit**

### Thread C — Context and compaction

> **Headline question:** What does a harness throw away when it runs out of room, and how does it decide?

**Needs:** `captures/session-dsh-canonical.jsonl` · **Note:** `notes/C-context-and-compaction.md`

This is the densest engineering in the repo — `compaction` is a top-level package with a dedicated `compaction-tool-result-pruner`. Treat it as the centrepiece.

- [ ] **Measure the growth curve**

```bash
jq -r 'select(.dir=="request") | "\(.id)\t\(.body.messages | length)\t\(.body.messages | tostring | length)"' \
  captures/session-dsh-canonical.jsonl
```

- [ ] **Force a compaction event**

The canonical task is too short. Run a long one and look for a **drop** in message count:

```bash
mkdir -p /tmp/dsh-long && cd /tmp/dsh-long
CAPTURE_LABEL=dsh-long CAPTURE_UPSTREAM=https://api.deepseek.com \
  node /Users/claire/GitRepos/study-harness/tools/capture-proxy/server.mjs &
<LLM_BASE_URL_ENV>=http://127.0.0.1:8899 <DSH_CMD> "Create 12 small JS files each implementing a different sorting algorithm, run each one, and summarize which was fastest."
```

- [ ] **Read the pruner**

```bash
cd ../deepseek-harness
rg -n 'threshold|maxTokens|budget|trigger|shouldCompact' packages/compaction --type ts | head -25
rg -n 'prune|elide|truncat' packages/compaction/compaction-tool-result-pruner --type ts | head -20
```

Answer specifically: what survives compaction, what doesn't, and is the decision positional, semantic, or size-based?

- [ ] **Add resolved terms to `CONTEXT.md`, then commit**

### Thread D — Tool vertical slice

> **Headline question:** What must a harness be told about a tool, and where does the permission boundary sit?

**Needs:** nothing (source-only) · **Note:** `notes/D-tool-vertical-slice.md` · **Gates:** Exam 1

Pick the file-edit tool — it's where harnesses differ most and the only tool that must cross the permission boundary.

- [ ] **Trace all six layers, each cited `path:line`**

Schema definition → registration → presentation → dispatch → permission (`packages/guard`) → result serialization.

```bash
cd ../deepseek-harness
rg -n 'edit|write|patch|replace' packages/core/tools packages/fs --type ts -l | head -20
rg -n 'approve|permission|confirm|allow|deny' packages/guard --type ts | head -25
```

- [ ] **Confirm the trace against the capture**

```bash
jq -r 'select(.dir=="request") | .body.messages[] | select(.role=="tool") | .content | .[0:200]' \
  captures/session-dsh-canonical.jsonl | head -5
```

If the serialized shape differs from what you predicted, the reading is wrong. The wire wins.

- [ ] **Write the checklist: "what a new tool must provide"**

Exam 1 consumes this directly. Make it harness-neutral where you can — that's the category insight.

- [ ] **Add resolved terms to `CONTEXT.md`, then commit**

### Thread E — Plugin architecture

> **Headline question:** Where does dsh put its extension boundary, and what does that choice cost?

**Needs:** nothing (source-only) · **Note:** `notes/E-plugin-architecture.md`

- [ ] **Learn the Cordis model first**

Without it the codebase looks like indirection with no call graph — nothing calls anything directly, so grep-based tracing fails. Cordis has a paper behind it: *A Programming Paradigm for Spatiotemporal Composability*.

```bash
cd ../deepseek-harness
cat packages/core/README.md AGENTS.md CLAUDE.md packages/AGENTS.md
rg -n 'ctx\.(plugin|on|set|inject)' packages/core --type ts | head -25
```

Answer: what are `ctx.plugin`, `ctx.on`, `ctx.set`, and service injection?

- [ ] **Trace the plugin lifecycle from `packages/boot` through registration**

- [ ] **Record the cost of "everything is a plugin"** — what does this architecture make hard that a monolithic core would make easy?

- [ ] **Add resolved terms to `CONTEXT.md`, then commit**

---

## Phase 2 — The Exams

Notes accumulate understanding but never test it. These can fail.

### Exam 1: One tool, two harnesses

> **Gates on:** Thread D's checklist

The same trivial tool integrated into both harnesses. The *diff between the two integrations* is the category insight — everything both require is essential; everything only one requires is incidental.

- [ ] **Step 1: Build it as a dsh plugin**

`experiments/hello-tool-dsh/`. A single tool `hello_study` taking one string and returning the literal marker `STUDY-MARKER-7f3a`, so it's unambiguously greppable. Find the smallest existing tool plugin in the repo first and copy its shape exactly — do not invent structure.

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

- [ ] **Step 2: Build the same tool as an MCP server**

`experiments/hello-tool-mcp/`, using `@modelcontextprotocol/sdk`. Identical name, parameters, and marker.

- [ ] **Step 3: Verify both round trips close**

For each harness, prove two things — the tool was *offered*, and the model *called* it:

```bash
# offered
jq -r 'select(.dir=="request") | .body.tools[]? | .function.name' captures/session-<label>.jsonl | sort -u | rg hello_study
# called
rg -c 'STUDY-MARKER-7f3a' captures/session-<label>.jsonl
```

Both must pass. Step one alone proves only that the tool was offered, not that the loop closed around it.

- [ ] **Step 4: Write the diff** — append to `notes/D-tool-vertical-slice.md`: what did both harnesses demand, and what did only one? The intersection is the category model of "a tool."

- [ ] **Step 5: Commit**

### Exam 2: A minimal harness from scratch

> **Gates on:** Threads A, B, C and Exam 1

~200 lines that implement the loop: assemble context, call the model, parse tool calls, execute, append, repeat. Targets the Anthropic API, since that key is already available. Two tools only — read a file, run a command.

**This is the exam that can't be faked.** It is also the one most likely to become the project instead of the study. Guard against that explicitly:

- [ ] **Step 1: Set the budget before starting** — a fixed number of sessions. When it's spent, the harness is whatever it is. It is a proof, not a product.
- [ ] **Step 2: Implement the loop** in `experiments/minimal-harness/`. No plugin system, no compaction, no permission layer — those are deliberately out of scope and their absence is itself a finding.
- [ ] **Step 3: Run the canonical task through it** and capture it with the same proxy. Three harnesses, one task, comparable captures.
- [ ] **Step 4: Record what you got wrong** — every place your model of the loop turned out to be incomplete. Append to `notes/B-agent-loop.md`. This list is the single most valuable artifact in the study.
- [ ] **Step 5: Commit**

---

## Phase 3 — The Transfer Test

> **Headline question:** Does a vocabulary derived from dsh explain a harness it wasn't derived from?

**Needs:** `captures/session-cc-canonical.jsonl` (banked in Task 0.3), all Phase 1 notes · **Note:** `notes/X-transfer-test.md`

Do this **last**. Analysing Claude Code earlier would seed the vocabulary with its concepts and make the test circular.

- [ ] **Step 1: Predict before looking**

Write down, from the dsh-derived model alone, what you expect to find in the Claude Code capture: roughly how many tools, whether behavioural instruction sits in descriptions or the system prompt, how tool results are serialized, what triggers compaction. Commit these predictions **before** opening the capture. A prediction made after the fact tests nothing.

- [ ] **Step 2: Open the banked capture and score the predictions**

```bash
jq -r 'select(.dir=="request") | .body.tools[]? | .function.name' captures/session-cc-canonical.jsonl | sort -u
jq -r 'select(.dir=="request") | "\(.id)\t\(.body.messages | length)"' captures/session-cc-canonical.jsonl
```

- [ ] **Step 3: Classify every term in `CONTEXT.md`**

Three buckets: **universal** (explains both harnesses), **dsh-specific** (an implementation detail you mistook for a category concept), **missing** (Claude Code does something your vocabulary has no word for). The second and third buckets are the study's real output.

Remember the constraint: describe structure and behaviour, never commit Claude Code's prompt text. This repo is public.

- [ ] **Step 4: Rewrite `CONTEXT.md`** keeping only the universal terms as canonical, with dsh-specific ones clearly marked as such.

- [ ] **Step 5: Commit and push**

---

## Notes on Adapting This Plan

Threads name `packages/*` directories confirmed to exist at the pinned SHA, but the files inside them are discovered during execution. Where a step says "record it as `X`", that value is a real deliverable consumed by name later — deliberate, not a placeholder.

If an `rg` command returns nothing, that is itself a finding: the concept is named differently here than expected. Record the actual name and move on. Never skip a step silently.

If a thread runs dry, honour the surprise budget — file the issue and pick another. Grinding a dry seam because it's next in the document is exactly what the open-ended structure exists to prevent.
