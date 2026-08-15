# DeepSeek Harness Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, evidence-backed understanding of how the DeepSeek Harness (`dsh`) agent framework operates, and prove that understanding by extending it with a working plugin.

**Architecture:** Study proceeds outside-in. We first capture ground truth from the wire (every request `dsh` sends to the model API), then read source only to explain what we already observed. Notes live in this repo; the upstream checkout is a pinned, read-only sibling clone. The final deliverable is a set of annotated notes plus a plugin that demonstrably appears in captured traffic.

**Tech Stack:** TypeScript, Node.js ≥20, pnpm workspaces, Cordis (plugin/DI framework), Vitest. Capture tooling is dependency-free Node (`node:http` + built-in `fetch`).

**Spec:** No separate spec document. The methodology this plan implements is captured inline in "Study Thesis" below, derived from the study-approach discussion on 2026-08-15.

## Study Thesis

A harness is one loop: assemble context → call model → parse tool calls → execute → append results → repeat until stop. Everything else is decoration hanging off that loop. Three claims drive the task order:

1. **Wire traffic beats source reading.** Prompt assembly is scattered across many files; the bytes on the wire are the single ground truth. Capture first, read second.
2. **Read vertically, not horizontally.** One complete path through every layer (schema → registration → dispatch → permission → execution → serialization) teaches more than each layer surveyed across all features.
3. **Extension is the exam.** You do not understand a harness until you have added a tool to it and watched the model call it.

## Global Constraints

- **Upstream is read-only and pinned.** Clone `deepseek-ai/deepseek-harness` at commit `47f943859bef60e4160492346772ded9b24f765a` (branch `master`, dated 2026-08-13). Never commit to it, never update it mid-study — every `file:line` citation in notes must resolve at this SHA.
- **Upstream location:** `../deepseek-harness`, a sibling of this repo. Never nest it inside this repo.
- **Never commit captures.** Captured traffic contains prompts and may contain credentials. `captures/` is gitignored and the proxy redacts auth headers at write time. This is non-negotiable.
- **Every source claim in notes cites `path:line`** relative to the upstream repo root, e.g. `packages/core/agent-loop/src/index.ts:142`.
- **Notes are markdown under `notes/`**, numbered in reading order.
- **Commit after every task.** One task, one commit.

## File Structure

Created in **this** repo (`study-harness`):

| Path | Responsibility |
|---|---|
| `.gitignore` | Excludes `captures/`, `node_modules/`, `.env` |
| `notes/00-orientation.md` | Pinned SHA, package map, discovered env var names |
| `notes/01-baseline-behavior.md` | What `dsh` does, observed before reading any source |
| `notes/02-prompt-and-tools.md` | Extracted system prompt + tool schemas, annotated |
| `notes/03-context-and-compaction.md` | How the message array evolves; compaction strategy |
| `notes/04-agent-loop.md` | The loop, mapped to source with `file:line` |
| `notes/05-tool-vertical-slice.md` | One tool traced through every layer |
| `notes/06-plugin-architecture.md` | Cordis model, how plugins register |
| `notes/07-synthesis.md` | Design decisions, trade-offs, comparison |
| `CONTEXT.md` | Domain glossary (consumed by the domain-modeling skills) |
| `tools/capture-proxy/server.mjs` | Logging reverse proxy — the core instrument |
| `tools/capture-proxy/README.md` | How to run a capture session |
| `experiments/hello-tool-plugin/` | The exam: a working dsh plugin |

Read-only in `../deepseek-harness`, the primary study targets:

| Path | Why it matters |
|---|---|
| `packages/core/agent-loop` | The loop itself |
| `packages/core/system-prompt` | Prompt assembly |
| `packages/core/agent-tool-presentation` | How tools are shown to the model |
| `packages/core/tools` | Tool registry and dispatch |
| `packages/core/scope` | Cordis scoping |
| `packages/compaction/compaction-tool-result-pruner` | What gets elided from context |
| `packages/llm/llm-deepseek` | Provider client — where the base URL is configured |
| `packages/guard` | Permission / approval layer |
| `packages/boot` | Plugin loading |

---

### Task 1: Pin the upstream checkout and scaffold the study repo

**Files:**
- Create: `.gitignore`
- Create: `notes/00-orientation.md`
- Clone (outside repo): `../deepseek-harness` at the pinned SHA

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a built upstream checkout at the pinned SHA; `notes/00-orientation.md` recording **(a)** the pinned SHA, **(b)** the package map, **(c)** `LLM_BASE_URL_ENV` — the exact environment variable or config key that overrides the model API base URL, and **(d)** `DSH_CMD` — the exact command that starts a non-interactive run. Tasks 2, 3, and 8 depend on (c) and (d) by these names.

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

Expected: prints `47f943859bef60e4160492346772ded9b24f765a`. Detached HEAD is correct and intended.

- [ ] **Step 3: Install and build**

```bash
cd ../deepseek-harness
corepack enable
pnpm install --frozen-lockfile
pnpm build 2>&1 | tail -20
```

If `pnpm build` is not a defined script, list what is: `node -e "console.log(Object.keys(require('./package.json').scripts))"` and use the build-equivalent. Record whichever worked in `notes/00-orientation.md`.

- [ ] **Step 4: Verify the harness runs**

```bash
cd ../deepseek-harness
pnpm dsh --help 2>&1 | head -30
```

Expected: a usage/help listing including subcommands. If `pnpm dsh` is not wired, find the binary: `node -e "const p=require('./package.json');console.log(p.bin)"` across `apps/*/package.json`. Record the working invocation as `DSH_CMD`.

- [ ] **Step 5: Discover the base-URL override**

```bash
cd ../deepseek-harness
rg -n 'baseURL|baseUrl|base_url|BASE_URL' packages/llm/ apps/ --type ts | head -30
rg -n 'process\.env\.[A-Z_]+' packages/llm/ --type ts -o | sort -u | head -30
```

Expected: at least one environment variable or settings key that sets the provider base URL. Record it as `LLM_BASE_URL_ENV`. If it turns out to be a settings-file key rather than an env var, record the file path and key path instead — Task 3 handles either.

- [ ] **Step 6: Write `notes/00-orientation.md`**

Record, with no interpretation yet:

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

### Task 2: Baseline behavioral observation

**Files:**
- Create: `notes/01-baseline-behavior.md`

**Interfaces:**
- Consumes: `DSH_CMD` from Task 1
- Produces: `CANONICAL_TASK` — a fixed, repeatable prompt used identically in Tasks 2, 3, 5, and 8, so captures are comparable across the study.

- [ ] **Step 1: Define the canonical task**

Use exactly this prompt for every run in this study. It forces read → edit → execute, exercising at least three distinct tools:

```
Create a file called fizzbuzz.js that prints FizzBuzz for 1..20,
then run it with node and show me the output.
```

- [ ] **Step 2: Run it in a scratch directory**

```bash
mkdir -p /tmp/dsh-baseline && cd /tmp/dsh-baseline
<DSH_CMD> "Create a file called fizzbuzz.js that prints FizzBuzz for 1..20, then run it with node and show me the output."
```

- [ ] **Step 3: Record observations before reading any source**

Write `notes/01-baseline-behavior.md` answering only what was observable:

- How many model round-trips occurred, if visible?
- Which tools were called, in what order?
- Was approval requested before the write? Before the shell command?
- What did the harness display between steps (streaming? tool-call summaries?)
- Did it verify its own work, or stop at first success?

- [ ] **Step 4: Verify the note contains no source citations**

```bash
rg -n 'packages/' notes/01-baseline-behavior.md
```

Expected: no matches. This note is deliberately observation-only — it is the control against which source reading is later checked.

- [ ] **Step 5: Commit**

```bash
git add notes/01-baseline-behavior.md
git commit -m "study: baseline behavioral observation of dsh"
```

---

### Task 3: Build the wire-capture proxy

**Files:**
- Create: `tools/capture-proxy/server.mjs`
- Create: `tools/capture-proxy/README.md`

**Interfaces:**
- Consumes: `LLM_BASE_URL_ENV`, `DSH_CMD` from Task 1; `CANONICAL_TASK` from Task 2
- Produces: `captures/session-<label>.jsonl` — one JSON object per line, alternating `dir:"request"` / `dir:"response"`, correlated by `id`. Tasks 4, 5, and 8 read this file.

- [ ] **Step 1: Write the proxy**

Streaming-safe (tees SSE to disk without buffering the client's view) and redacts credentials at write time.

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

- [ ] **Step 2: Start the proxy and verify it forwards**

```bash
cd /Users/claire/GitRepos/study-harness
CAPTURE_LABEL=smoke node tools/capture-proxy/server.mjs &
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8899/v1/models -H "Authorization: Bearer $DEEPSEEK_API_KEY"
```

Expected: a `200` (or a `401` if the key is unset — either proves forwarding works; a connection error does not).

- [ ] **Step 3: Verify credentials are redacted**

```bash
rg -n 'Bearer|sk-' captures/session-smoke.jsonl
```

Expected: **no matches.** If this prints anything, stop and fix `redact()` before continuing — a leaked key in a capture is the one unrecoverable mistake in this study.

- [ ] **Step 4: Capture the canonical task**

```bash
mkdir -p /tmp/dsh-capture && cd /tmp/dsh-capture
CAPTURE_LABEL=canonical node /Users/claire/GitRepos/study-harness/tools/capture-proxy/server.mjs &
<LLM_BASE_URL_ENV>=http://127.0.0.1:8899 <DSH_CMD> "Create a file called fizzbuzz.js that prints FizzBuzz for 1..20, then run it with node and show me the output."
```

If `LLM_BASE_URL_ENV` turned out to be a settings key rather than an env var, edit that settings file to point at `http://127.0.0.1:8899` instead, and note the edit.

- [ ] **Step 5: Verify the capture contains a real agent turn**

```bash
cd /Users/claire/GitRepos/study-harness
jq -r 'select(.dir=="request") | .body.messages[0].role' captures/session-canonical.jsonl | head -3
jq -r 'select(.dir=="request") | (.body.tools // []) | length' captures/session-canonical.jsonl | head -3
```

Expected: first prints `system` (a system message is present); second prints a non-zero tool count. If tools are zero, the harness may send them under a different key — inspect with `jq 'select(.dir=="request") | .body | keys' | head -1`.

- [ ] **Step 6: Write the README**

`tools/capture-proxy/README.md` documents: the four env vars, the start command, the redaction guarantee, and the `jq` one-liners from Step 5.

- [ ] **Step 7: Commit**

```bash
git add tools/capture-proxy/
git commit -m "study: add streaming-safe wire-capture proxy with credential redaction"
```

---

### Task 4: Extract and annotate the system prompt and tool schemas

**Files:**
- Create: `notes/02-prompt-and-tools.md`

**Interfaces:**
- Consumes: `captures/session-canonical.jsonl` from Task 3
- Produces: the verbatim system prompt and the tool-schema inventory, both cited to source in `packages/core/system-prompt` and `packages/core/agent-tool-presentation`.

- [ ] **Step 1: Extract the system prompt verbatim**

```bash
jq -r 'select(.dir=="request") | .body.messages[] | select(.role=="system") | .content' \
  captures/session-canonical.jsonl | head -1 > /tmp/system-prompt.txt
wc -l /tmp/system-prompt.txt
```

- [ ] **Step 2: Extract the tool inventory**

```bash
jq -r 'select(.dir=="request") | .body.tools[]? | "\(.function.name)\t\(.function.description | .[0:100])"' \
  captures/session-canonical.jsonl | sort -u
```

- [ ] **Step 3: Find where the prompt is assembled in source**

```bash
cd ../deepseek-harness
ls packages/core/system-prompt
rg -n 'You are|<system|systemPrompt' packages/core/system-prompt --type ts | head -20
```

Take a distinctive 6-word phrase from the captured prompt and locate it: `rg -n "<phrase>" packages/ --type ts`. If it is not found literally, it is assembled from fragments — record which fragments and where.

- [ ] **Step 4: Find where tools are presented to the model**

```bash
cd ../deepseek-harness
ls packages/core/agent-tool-presentation
rg -n 'description|parameters|toJSON|schema' packages/core/agent-tool-presentation --type ts | head -20
```

- [ ] **Step 5: Write `notes/02-prompt-and-tools.md`**

Required sections:

- **Verbatim system prompt**, in a fenced block, with an explicit note of its length in lines and approximate tokens.
- **Section-by-section annotation** — for each block of the prompt, what behavior it is trying to buy.
- **Tool inventory table** — name, one-line purpose, and the ratio of instruction-in-description vs instruction-in-system-prompt.
- **Assembly trace** — `path:line` for where each part originates.
- **The key question, answered:** how much behavior is smuggled into tool *descriptions* rather than the system prompt? Quantify it.

- [ ] **Step 6: Verify every claim is cited**

```bash
rg -c 'packages/' notes/02-prompt-and-tools.md
```

Expected: at least 5 matches. Uncited structural claims are the failure mode here.

- [ ] **Step 7: Commit**

```bash
git add notes/02-prompt-and-tools.md
git commit -m "study: extract and annotate system prompt and tool schemas"
```

---

### Task 5: Map the context strategy and compaction

**Files:**
- Create: `notes/03-context-and-compaction.md`

**Interfaces:**
- Consumes: `captures/session-canonical.jsonl` from Task 3; `CANONICAL_TASK` from Task 2
- Produces: the observed context-growth curve and the compaction trigger condition, cited to `packages/compaction/*`.

- [ ] **Step 1: Measure how the message array grows per turn**

```bash
jq -r 'select(.dir=="request") | "\(.id)\t\(.body.messages | length)\t\(.body.messages | tostring | length)"' \
  captures/session-canonical.jsonl
```

Expected: three columns — request id, message count, approximate payload size. This is the growth curve.

- [ ] **Step 2: Check whether earlier messages are ever rewritten**

```bash
jq -r 'select(.dir=="request") | .body.messages[1].content | .[0:80]' \
  captures/session-canonical.jsonl | uniq -c
```

Expected: if the count equals the number of requests, the first user message is passed through untouched. Any variation means rewriting — investigate it.

- [ ] **Step 3: Generate a long-running capture to trigger compaction**

The canonical task is too short to compact. Run a deliberately long one:

```bash
mkdir -p /tmp/dsh-long && cd /tmp/dsh-long
CAPTURE_LABEL=long node /Users/claire/GitRepos/study-harness/tools/capture-proxy/server.mjs &
<LLM_BASE_URL_ENV>=http://127.0.0.1:8899 <DSH_CMD> "Clone nothing, but create 12 small JS files each implementing a different sorting algorithm, run each one, and summarize which was fastest."
```

- [ ] **Step 4: Detect the compaction event in the capture**

```bash
cd /Users/claire/GitRepos/study-harness
jq -r 'select(.dir=="request") | "\(.id)\t\(.body.messages | length)"' captures/session-long.jsonl
```

Expected: a monotonic rise followed by a **drop** in message count. That drop is a compaction event. If no drop occurs, the run did not reach the threshold — note that and read the threshold from source instead.

- [ ] **Step 5: Read the compaction source**

```bash
cd ../deepseek-harness
ls packages/compaction/compaction packages/compaction/compaction-basic packages/compaction/compaction-tool-result-pruner
rg -n 'threshold|maxTokens|budget|trigger|shouldCompact' packages/compaction --type ts | head -25
rg -n 'prune|elide|truncat' packages/compaction/compaction-tool-result-pruner --type ts | head -20
```

- [ ] **Step 6: Write `notes/03-context-and-compaction.md`**

Required sections:

- **Growth curve** — the table from Step 1.
- **Compaction trigger** — the exact condition, cited to `path:line`.
- **What survives compaction and what does not** — specifically, how `compaction-tool-result-pruner` decides which tool results to drop. This is the most interesting engineering in the repo; treat it as the centerpiece.
- **Observed vs documented** — where the capture disagreed with what the source implied.

- [ ] **Step 7: Commit**

```bash
git add notes/03-context-and-compaction.md
git commit -m "study: map context growth and compaction strategy"
```

---

### Task 6: Map the agent loop in source

**Files:**
- Create: `notes/04-agent-loop.md`

**Interfaces:**
- Consumes: `notes/01-baseline-behavior.md` (the observed behavior this must explain)
- Produces: `LOOP_ENTRY` — the `path:line` of the main loop function. Task 7 starts from it.

- [ ] **Step 1: Locate the loop**

```bash
cd ../deepseek-harness
ls -R packages/core/agent-loop | head -30
rg -n 'while|for await|async function.*[Ll]oop|step|turn' packages/core/agent-loop --type ts | head -30
```

- [ ] **Step 2: Identify the five phases**

In the loop body, mark the line where each of these happens. Every harness has all five:

1. Assemble context (messages + system + tools)
2. Call the model
3. Parse tool calls from the response
4. Execute tools
5. Append results and decide whether to continue

- [ ] **Step 3: Find the termination condition**

```bash
cd ../deepseek-harness
rg -n 'break|return|maxSteps|maxTurns|stop|finish' packages/core/agent-loop --type ts | head -25
```

The question to answer: what stops the loop — the model emitting no tool calls, a step cap, a token budget, or user interrupt? Usually several; record all of them and their precedence.

- [ ] **Step 4: Read the loop's tests as executable spec**

The tests state the invariants the maintainers actually care about and the edge cases they hit — the "why is this weird code here" answers that comments never give.

```bash
cd ../deepseek-harness
cat vitest.config.ts vitest.*.config.ts 2>/dev/null | head -30
fd -e test.ts -e spec.ts . packages/core/agent-loop packages/compaction 2>/dev/null || \
  rg -l 'describe\(|it\(|test\(' packages/core/agent-loop packages/compaction --type ts
```

Run them and read the names — test names are a specification in prose:

```bash
cd ../deepseek-harness
pnpm vitest run packages/core/agent-loop --reporter=verbose 2>&1 | head -40
```

Record any invariant that surprised you. A test guarding behavior you did not predict marks a gap in your model of the loop.

- [ ] **Step 5: Write `notes/04-agent-loop.md`**

Required content:

- **A numbered walkthrough** of one iteration, each step cited `path:line`.
- **A diagram** (ASCII or mermaid) of the loop with its exit edges.
- **Termination conditions**, all of them, in precedence order.
- **Invariants from tests** — what the suite guarantees, and which of those you would not have predicted from reading the implementation alone.
- **The reconciliation:** explicitly answer each observation recorded in `notes/01-baseline-behavior.md` — which line of the loop produced it? Anything you observed but cannot locate in source is an open question; list it as such rather than glossing over it.

- [ ] **Step 6: Verify the reconciliation is complete**

Re-read `notes/01-baseline-behavior.md`. Every observation in it must appear in the reconciliation section, either explained or listed as open. This check is the whole point of having written the baseline note first.

- [ ] **Step 7: Commit**

```bash
git add notes/04-agent-loop.md
git commit -m "study: map the agent loop to source with reconciliation"
```

---

### Task 7: Trace one tool through every layer

**Files:**
- Create: `notes/05-tool-vertical-slice.md`

**Interfaces:**
- Consumes: `LOOP_ENTRY` from Task 6
- Produces: the full dispatch path for one tool — the template Task 8's plugin must satisfy.

- [ ] **Step 1: Pick the file-edit tool**

File-edit is the right choice: it is where harnesses differ most, and it is the one tool that must pass through the permission layer.

```bash
cd ../deepseek-harness
ls packages/core/tools
rg -n 'edit|write|patch|replace' packages/core/tools packages/fs --type ts -l | head -20
```

- [ ] **Step 2: Trace all six layers**

Record `path:line` for each:

1. **Schema definition** — where its parameters are declared
2. **Registration** — where it joins the tool registry
3. **Presentation** — where it becomes JSON for the model (cross-check against the capture from Task 4)
4. **Dispatch** — where a model tool-call is routed to it
5. **Permission** — where `packages/guard` gates it
6. **Result serialization** — what shape the result takes when appended to messages

- [ ] **Step 3: Read the permission layer specifically**

```bash
cd ../deepseek-harness
ls packages/guard
rg -n 'approve|permission|confirm|allow|deny' packages/guard --type ts | head -25
```

Answer: is approval per-call, per-tool, per-session, or path-scoped? What is the default posture?

- [ ] **Step 4: Confirm the trace against the capture**

```bash
cd /Users/claire/GitRepos/study-harness
jq -r 'select(.dir=="request") | .body.messages[] | select(.role=="tool") | .content | .[0:200]' \
  captures/session-canonical.jsonl | head -5
```

Expected: the serialized tool results, matching the shape you predicted in Step 2 layer 6. If the shape differs from your reading, the reading is wrong — the wire wins. Fix the note.

- [ ] **Step 5: Write `notes/05-tool-vertical-slice.md`**

A six-section walkthrough, one per layer, each with `path:line` and the relevant code quoted. Close with **"What a new tool must provide"** — a checklist derived from the trace. Task 8 consumes this checklist directly.

- [ ] **Step 6: Commit**

```bash
git add notes/05-tool-vertical-slice.md
git commit -m "study: trace file-edit tool through all six layers"
```

---

### Task 8: Understand the plugin architecture and pass the exam

**Files:**
- Create: `notes/06-plugin-architecture.md`
- Create: `experiments/hello-tool-plugin/package.json`
- Create: `experiments/hello-tool-plugin/src/index.ts`

**Interfaces:**
- Consumes: the "What a new tool must provide" checklist from Task 7; `LLM_BASE_URL_ENV`, `DSH_CMD` from Task 1
- Produces: a plugin whose tool is provably present in captured wire traffic and provably invoked by the model.

- [ ] **Step 1: Learn the Cordis model**

Cordis is dependency-injection plus an event bus. Without it, the codebase looks like indirection with no call graph — nothing calls anything directly, so grep-based tracing fails. Read enough to answer: what are `ctx.plugin`, `ctx.on`, `ctx.set`, and service injection?

```bash
cd ../deepseek-harness
cat packages/core/README.md
ls packages/core/scope packages/boot
rg -n 'ctx\.(plugin|on|set|inject)' packages/core --type ts | head -25
```

- [ ] **Step 2: Read the maintainers' own orientation docs**

```bash
cd ../deepseek-harness
cat AGENTS.md
cat CLAUDE.md
cat packages/AGENTS.md
```

These are written for agents working in the codebase, which makes them the best human onboarding docs too — and usually more current than `docs/`.

- [ ] **Step 3: Find a minimal existing tool plugin to copy**

```bash
cd ../deepseek-harness
ls examples packages/examples 2>/dev/null
rg -n 'export default|export function apply' packages/core/tools --type ts | head -15
```

Pick the smallest complete tool plugin. Copy its shape exactly — do not invent structure.

- [ ] **Step 4: Write the plugin**

A single tool, `hello_study`, taking one string parameter and returning a fixed marker string. Deliberately trivial: the point is the wiring, not the tool. The returned marker must be the literal `STUDY-MARKER-7f3a` so it is unambiguously greppable in the capture.

Start from this skeleton, then **replace the registration call and imports with the exact shape found in Step 3** — the Cordis API surface is what Step 3 discovers, and the real plugin in the repo is authoritative over this sketch:

```typescript
// experiments/hello-tool-plugin/src/index.ts
import type { Context } from 'cordis'

export const name = 'hello-study'

export interface Config {}

export function apply(ctx: Context) {
  // ↓ Replace `ctx.tool` with whatever registration method Step 3 revealed.
  ctx.tool({
    name: 'hello_study',
    description: 'A study probe. Returns a fixed marker string for the given word.',
    parameters: {
      type: 'object',
      properties: {
        word: { type: 'string', description: 'Any word to echo back.' },
      },
      required: ['word'],
    },
    async execute({ word }: { word: string }) {
      return `STUDY-MARKER-7f3a received:${word}`
    },
  })
}
```

And the manifest, with `<version>` and the dependency name copied from the sibling plugin inspected in Step 3:

```json
{
  "name": "@study/hello-tool-plugin",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "peerDependencies": { "cordis": "*" }
}
```

Every item on the Task 7 "What a new tool must provide" checklist must be satisfied. If the checklist names a layer this skeleton omits (a guard/permission declaration, for instance), add it — the checklist is authoritative, not the skeleton.

- [ ] **Step 5: Load the plugin and verify it reaches the model**

```bash
mkdir -p /tmp/dsh-plugin && cd /tmp/dsh-plugin
CAPTURE_LABEL=plugin node /Users/claire/GitRepos/study-harness/tools/capture-proxy/server.mjs &
<LLM_BASE_URL_ENV>=http://127.0.0.1:8899 <DSH_CMD> "Call the hello_study tool with the word banana and tell me exactly what it returned."
```

Then:

```bash
cd /Users/claire/GitRepos/study-harness
jq -r 'select(.dir=="request") | .body.tools[]? | .function.name' captures/session-plugin.jsonl | sort -u | rg hello_study
```

Expected: prints `hello_study`. This proves registration → presentation worked.

- [ ] **Step 6: Verify the model actually called it**

```bash
rg -c 'STUDY-MARKER-7f3a' captures/session-plugin.jsonl
```

Expected: at least 1. This proves dispatch → execution → serialization worked. **Both Step 5 and Step 6 must pass** — Step 5 alone only proves the tool was offered, not that the round trip closed.

- [ ] **Step 7: Write `notes/06-plugin-architecture.md`**

Required content:

- **The Cordis model** in your own words — DI, events, scoping.
- **The plugin lifecycle** — from `packages/boot` through registration, cited `path:line`.
- **What the exam cost:** every point where you needed trial and error rather than deduction. These are the real gaps in the architecture's discoverability and the most valuable thing in this note.

- [ ] **Step 8: Commit**

```bash
git add notes/06-plugin-architecture.md experiments/hello-tool-plugin/
git commit -m "study: document plugin architecture and add working hello_study plugin"
```

---

### Task 9: Synthesis and domain glossary

**Files:**
- Create: `notes/07-synthesis.md`
- Create: `CONTEXT.md`

**Interfaces:**
- Consumes: all prior notes
- Produces: the study's conclusions, and a glossary the domain-modeling skills will consume per `docs/agents/domain.md`.

- [ ] **Step 1: Write `CONTEXT.md`**

A glossary of the terms this codebase uses, in its own vocabulary — harness, loop, turn, step, tool, plugin, scope, compaction, pruner, guard, preset, session. One line each, using the term as `dsh` uses it. `docs/agents/domain.md` directs every other skill to read this before exploring, so precision here pays off later.

- [ ] **Step 2: Write the design-decision inventory**

For each, state what `dsh` chose and what it bought:

- Everything-is-a-plugin on Cordis, vs a monolithic core
- Compaction as a dedicated package with a pluggable pruner
- A separate `guard` package for permissions
- `agent-tool-presentation` split out from the tool registry itself

- [ ] **Step 3: Recover design rationale from history**

Rationale lives in commit messages and PR descriptions, not in code. For each design decision from Step 2, find why it was made:

```bash
cd ../deepseek-harness
git log --oneline -- packages/compaction | head -20
git log --format='%H %s%n%b' -5 -- packages/compaction/compaction-tool-result-pruner
```

Then read the corresponding PRs — the discussion is usually richer than the merged message:

```bash
gh pr list --repo deepseek-ai/deepseek-harness --state merged --limit 20 \
  --json number,title,url --jq '.[] | "\(.number)\t\(.title)"'
gh pr view <number> --repo deepseek-ai/deepseek-harness --comments | head -60
```

Record any decision whose stated rationale contradicts what you inferred from the code. Those are the most interesting findings in the study.

- [ ] **Step 4: Compare against a harness you already know**

The useful question is not "how does dsh do tool calls" but "where did dsh choose differently, and what did that buy them." Write a short comparison table across four axes: **permission model**, **context compaction**, **subagents/delegation**, and **plugin boundary**. Where dsh diverges from the harness you know best, state which trade-off each side took.

- [ ] **Step 5: Record open questions**

Every item listed as unresolved in Tasks 4–8, plus contradictions found in Step 3, gathered in one place. Convert each into a GitHub issue:

```bash
gh issue create --title "<question>" --label needs-triage --body "<context and what you tried>"
```

This is what the tracker configured in `docs/agents/issue-tracker.md` is for, and `needs-triage` already exists on the repo.

- [ ] **Step 6: Verify plan coverage**

Confirm every note file listed in "File Structure" exists:

```bash
ls notes/
```

Expected: `00` through `07`, eight files.

- [ ] **Step 7: Commit and push**

```bash
git add CONTEXT.md notes/07-synthesis.md
git commit -m "study: synthesis, design-decision inventory, and domain glossary"
git push
```

---

## Notes on Adapting This Plan

Tasks 4–8 name specific `packages/*` directories confirmed to exist at the pinned SHA, but the files *inside* them are discovered during execution rather than asserted here. Where a step says "record it as `X`", that value is a real deliverable of that task and later tasks consume it by name — this is deliberate, not a placeholder.

If a `rg` command in any task returns nothing, that is itself a finding: it means the concept is named differently in this codebase than expected. Record the actual name in the relevant note and move on. Do not skip the step silently.
