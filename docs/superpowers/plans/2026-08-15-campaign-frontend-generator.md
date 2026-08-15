# Campaign Frontend Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `roadmap.html`, `worklog.html`, and the campaign board from one `campaign.json` per campaign, so page state and thread data cannot drift from their source.

**Architecture:** A dependency-free Node ES-module generator under `tools/`. `model.mjs` loads and validates `campaign.json` then derives everything computable (surprise pips, dry detection, frontier, totals, graph edges, package census). Three render modules turn the model into HTML using one shared CSS block. A CLI writes the pages; `--check` regenerates and diffs to prove the committed HTML matches its data.

**Tech Stack:** Node ≥20 (v26.4.0 present), ES modules (`.mjs`), `node --test` for tests, `node:assert/strict`. **No `package.json`, no npm dependencies, no build step for readers.**

**Spec:** `docs/superpowers/specs/2026-08-15-campaign-frontend-design.md`

## Global Constraints

- **Zero dependencies.** No `package.json`, no `npm install`. Node built-ins only.
- **ES modules only** — every file is `.mjs` with `import`/`export`.
- **Generated HTML must contain:** `<meta charset="utf-8">` as the first line, within the first 1024 bytes.
- **Generated HTML must NOT contain:** `<script>`, `<link>`, `@import`, `src=`, `@font-face`, or `<details>`.
- **Three-state theming.** Bare `:root` defines the complete light palette; `@media (prefers-color-scheme: dark)` redefines tokens guarded by `:root:not([data-theme="light"])`; `:root[data-theme="dark"]` redefines them again. No colour may be defined only inside a media or `[data-theme]` block.
- **`body` sets an explicit `background` from a token.**
- **Thread letters are `A`–`O`.** Anchors are `#tA`–`#tO` on both roadmap and worklog.
- **Package names are NOT unique across threads.** `sdk` appears in threads H and N; `bundle` in thread E and the infrastructure list. Never enforce uniqueness.
- **`surpriseBudget` comes from data** (currently `2`), never hardcoded in render or derive logic.
- **All three generated pages are committed as HTML.**
- Run every command from the repo root `/Users/claire/GitRepos/study-harness` unless a step says otherwise.

## File Structure

| File | Responsibility |
|---|---|
| `tools/build-campaign.mjs` | CLI entry: argument parsing, file writing, `--check` diffing, exit codes |
| `tools/campaign/html.mjs` | HTML escaping and the restricted inline-markup allowlist |
| `tools/campaign/model.mjs` | Read `campaign.json`, validate it, derive computed state |
| `tools/campaign/theme.mjs` | The single CSS block shared by all three pages |
| `tools/campaign/graph.mjs` | The thread-graph SVG |
| `tools/campaign/render-roadmap.mjs` | `roadmap.html` |
| `tools/campaign/render-worklog.mjs` | `worklog.html` |
| `tools/campaign/render-board.mjs` | `campaigns/index.html` |
| `tools/campaign/checks.mjs` | HTML property checks used by tests and by `--check` |
| `tools/campaign/fixtures/` | Pre-migration snapshot, acceptance phrases, mini test campaign |
| `campaigns/agent-harnesses/campaign.json` | The real data |

---

## Task 1: Safety net — snapshot, acceptance phrases, HTML checks

Build the net **before** anything can fall. Task 8 rewrites `roadmap.html` from transcribed data; this task is what proves that rewrite lost nothing.

**Files:**
- Create: `tools/campaign/fixtures/roadmap-premigration.html` (copy)
- Create: `tools/campaign/fixtures/acceptance-phrases.txt`
- Create: `tools/campaign/checks.mjs`
- Test: `tools/campaign/checks.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `checkHtml(html, opts) → string[]` returning human-readable problems, empty array when clean. `opts` is `{ anchors = true }`; set `anchors: false` for HTML fragments.

- [ ] **Step 1: Snapshot the current roadmap**

```bash
mkdir -p tools/campaign/fixtures
cp campaigns/agent-harnesses/roadmap.html tools/campaign/fixtures/roadmap-premigration.html
wc -l tools/campaign/fixtures/roadmap-premigration.html   # expect 857
```

- [ ] **Step 2: Write the acceptance phrase list**

Create `tools/campaign/fixtures/acceptance-phrases.txt` with exactly these 60 lines:

```
47f943859bef60e4160492346772ded9b24f765a
corepack enable
sk-|Bearer
session-smoke.jsonl
STUDY-MARKER-7f3a
hello_study
02-baseline-behavior.md
01-what-my-harness-lacks.md
00-orientation.md
capture-proxy/server.mjs
minimal-harness/harness.mjs
LLM_BASE_URL_ENV
DSH_CMD
fizzbuzz.js
needs-triage
surprise budget
two consecutive findings
Analyse, don't dump
Spatiotemporal Composability
compaction-tool-result-pruner
127.0.0.1:3080
3,800
jsonrpc-agent
BENCHMARK.md
package-lock.json
twelve sorting algorithms
preventedContinuation
isSidechain
stopReason
permission-mode
tool_use
thinking
six layers
token-meter
session-query
Prompt &amp; presentation
The agent loop
Context &amp; compaction
Tools &amp; permission
Plugin architecture
Delegation &amp; sub-agents
Execution &amp; sandboxing
Interop
Persistence &amp; resumption
Observability &amp; cost
host boundary
Provider abstraction
Inputs &amp; code intelligence
Cross-language embedding
Agent self-management
You can't read what you can't name
The wire beats the source
A vocabulary must transfer
The wire wins
Never commit captures
Glossary as you go
canonical task
Universal
dsh-specific
Missing
```

- [ ] **Step 3: Verify every phrase is present in the snapshot**

```bash
while IFS= read -r p; do
  rg -qF -- "$p" tools/campaign/fixtures/roadmap-premigration.html || echo "MISSING: $p"
done < tools/campaign/fixtures/acceptance-phrases.txt
```

Expected: no output. If a phrase is missing, the list is wrong — fix the list, not the snapshot.

- [ ] **Step 4: Write the failing test**

Create `tools/campaign/checks.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkHtml } from './checks.mjs'

const GOOD = [
  '<meta charset="utf-8">',
  '<style>:root{--ink:#111;--bg:#fff}',
  '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ink:#eee;--bg:#111}}',
  ':root[data-theme="dark"]{--ink:#eee;--bg:#111}',
  'body{background:var(--bg);color:var(--ink)}</style>',
  '<a href="#x">go</a><div id="x">here</div>',
].join('\n')

test('clean html reports no problems', () => {
  assert.deepEqual(checkHtml(GOOD), [])
})

test('missing charset is reported', () => {
  assert.match(checkHtml(GOOD.replace('<meta charset="utf-8">', ''))[0], /charset/)
})

test('charset beyond 1024 bytes is reported', () => {
  const padded = '<!-- ' + 'x'.repeat(1100) + ' -->\n' + GOOD
  assert.ok(checkHtml(padded).some((p) => /charset/.test(p)))
})

test('external references are reported', () => {
  const bad = GOOD.replace('<a href', '<script src="x.js"></script><a href')
  assert.ok(checkHtml(bad).some((p) => /external/.test(p)))
})

test('details elements are reported', () => {
  assert.ok(checkHtml(GOOD + '<details><summary>x</summary></details>')
    .some((p) => /details/.test(p)))
})

test('a token used but not defined in bare :root is reported', () => {
  const bad = GOOD.replace('color:var(--ink)', 'color:var(--nope)')
  assert.ok(checkHtml(bad).some((p) => /--nope/.test(p)))
})

test('a dangling anchor is reported', () => {
  const bad = GOOD.replace('<div id="x">here</div>', '<div>here</div>')
  assert.ok(checkHtml(bad).some((p) => /#x/.test(p)))
})

test('unbalanced tags are reported', () => {
  assert.ok(checkHtml(GOOD + '<section><div></div>').some((p) => /section/.test(p)))
})

test('the pre-migration snapshot passes every check', () => {
  const html = readFileSync('tools/campaign/fixtures/roadmap-premigration.html', 'utf8')
  assert.deepEqual(checkHtml(html), [])
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `node --test tools/campaign/`
Expected: FAIL — `Cannot find module './checks.mjs'`.

- [ ] **Step 6: Implement `checks.mjs`**

```javascript
const EXTERNAL = /<script|<link\b|@import|\bsrc=|@font-face/i
const PAIRED = ['div', 'section', 'article', 'figure', 'table', 'svg', 'nav', 'main', 'dl', 'ul', 'p', 'span']

export function checkHtml(html, { anchors = true } = {}) {
  const problems = []

  const idx = html.indexOf('<meta charset="utf-8">')
  if (idx === -1) problems.push('missing <meta charset="utf-8">')
  else if (Buffer.byteLength(html.slice(0, idx), 'utf8') > 1024)
    problems.push('<meta charset="utf-8"> appears beyond the first 1024 bytes')

  if (EXTERNAL.test(html)) problems.push('external reference found (script/link/@import/src/@font-face)')
  if (/<details\b/i.test(html)) problems.push('<details> element found; nothing may collapse')

  // Tokens must be defined in the FIRST (bare) :root block.
  const bare = html.match(/:root\s*\{([^}]*)\}/)
  const defined = new Set([...(bare?.[1] ?? '').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  for (const m of html.matchAll(/var\((--[a-z0-9-]+)/g))
    if (!defined.has(m[1])) problems.push(`token ${m[1]} used but not defined in the bare :root`)

  if (!/body\s*\{[^}]*background\s*:\s*var\(--/.test(html))
    problems.push('body does not set background from a token')

  if (anchors) {
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
    for (const m of html.matchAll(/href="#([^"]+)"/g))
      if (!ids.has(m[1])) problems.push(`dangling anchor #${m[1]}`)
  }

  for (const tag of PAIRED) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
    if (open !== close) problems.push(`unbalanced <${tag}>: ${open} open, ${close} close`)
  }

  return problems
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test tools/campaign/`
Expected: PASS, 9 tests.

If `the pre-migration snapshot passes every check` fails, **do not weaken the check** — read the reported problem and confirm against the real file, because that check is the baseline every later task trusts.

- [ ] **Step 8: Commit**

```bash
git add tools/campaign/checks.mjs tools/campaign/checks.test.mjs tools/campaign/fixtures/
git commit -m "test: HTML property checks and the pre-migration acceptance baseline"
```

---

## Task 2: HTML escaping with a restricted inline allowlist

Thread entry commands contain `<`, `>`, `&&`, and quotes; prose contains `<b>` and `<code>`. These need different treatment, and getting it wrong either breaks the page or lets raw markup through.

**Files:**
- Create: `tools/campaign/html.mjs`
- Test: `tools/campaign/html.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `esc(s) → string` (escape everything), `rich(s) → string` (escape everything, then re-permit `<b> <i> <em> <strong> <code>` and their closers, attributes stripped), `attr(s) → string` (escape for a double-quoted attribute value).

- [ ] **Step 1: Write the failing test**

Create `tools/campaign/html.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esc, rich, attr } from './html.mjs'

test('esc escapes all five significant characters', () => {
  assert.equal(esc(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;')
})

test('esc handles a real entry command', () => {
  assert.equal(
    esc(`rg -n 'a|b' pkg && echo "done" > out`),
    'rg -n &#39;a|b&#39; pkg &amp;&amp; echo &quot;done&quot; &gt; out',
  )
})

test('rich permits the inline allowlist', () => {
  assert.equal(rich('a <b>bold</b> and <code>x</code>'), 'a <b>bold</b> and <code>x</code>')
})

test('rich escapes tags outside the allowlist', () => {
  assert.equal(rich('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
})

test('rich strips attributes from allowed tags', () => {
  assert.equal(rich('<b onclick="x()">t</b>'), '<b>t</b>')
})

test('rich still escapes ampersands', () => {
  assert.equal(rich('Tools &amp; permission'), 'Tools &amp;amp; permission')
  assert.equal(rich('Tools & permission'), 'Tools &amp; permission')
})

test('attr escapes quotes and angle brackets', () => {
  assert.equal(attr('a"b<c'), 'a&quot;b&lt;c')
})

test('non-string input throws rather than emitting undefined', () => {
  assert.throws(() => esc(undefined), /expected a string/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/html.test.mjs`
Expected: FAIL — `Cannot find module './html.mjs'`.

- [ ] **Step 3: Implement `html.mjs`**

```javascript
const ALLOWED = ['b', 'i', 'em', 'strong', 'code']

function must(s) {
  if (typeof s !== 'string') throw new TypeError(`expected a string, got ${typeof s}`)
  return s
}

export function esc(s) {
  return must(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function attr(s) {
  return must(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

export function rich(s) {
  const escaped = esc(s)
  const tags = ALLOWED.join('|')
  return escaped
    .replace(new RegExp(`&lt;(${tags})(?:\\s[^&]*?)?&gt;`, 'gi'), (_, t) => `<${t.toLowerCase()}>`)
    .replace(new RegExp(`&lt;/(${tags})&gt;`, 'gi'), (_, t) => `</${t.toLowerCase()}>`)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/campaign/html.test.mjs`
Expected: PASS, 8 tests.

Note the third `rich` assertion deliberately double-escapes a pre-escaped entity: source strings in `campaign.json` must contain the literal character `&`, never `&amp;`. Task 8's transcription must honour that.

- [ ] **Step 5: Commit**

```bash
git add tools/campaign/html.mjs tools/campaign/html.test.mjs
git commit -m "feat: HTML escaping with a restricted inline-markup allowlist"
```

---

## Task 3: Load and validate `campaign.json`

**Files:**
- Create: `tools/campaign/model.mjs`
- Create: `tools/campaign/fixtures/mini/campaign.json`
- Create: `tools/campaign/fixtures/mini/notes/A-alpha.md`
- Create: `tools/campaign/fixtures/mini/notes/B-beta.md`
- Test: `tools/campaign/model.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `readCampaign(dir) → data` — parses `<dir>/campaign.json`, validates it, returns the parsed object with `dir` attached. Throws `Error` whose message names the offending field.

- [ ] **Step 1: Create the mini test campaign**

`tools/campaign/fixtures/mini/campaign.json`:

```json
{
  "campaign": "mini",
  "title": "Mini",
  "subject": "test subject",
  "specimen": { "name": "spec", "pinned": "abc1234", "pinnedFull": "abc1234", "date": "2026-01-01" },
  "transferSpecimen": { "name": "other", "via": "transcripts" },
  "surpriseBudget": 2,
  "canonicalTask": "Do the thing.",
  "copy": { "standfirst": "A <b>mini</b> campaign.", "claims": [], "standingOrders": [], "sections": {} },
  "loopSteps": [
    { "id": "assemble", "label": "Assemble", "step": "Step 1", "question": "What goes in?" },
    { "id": "around", "label": "Around", "step": "Outside", "question": "What frames it?" }
  ],
  "phases": [],
  "threads": [
    { "letter": "A", "name": "Alpha", "loop": "assemble", "question": "A?",
      "raisedBy": { "kind": "toy", "text": "shortcut a" }, "packages": ["pkg-a", "shared"],
      "needs": "source", "gates": null, "entry": "rg -n 'a' .", "detail": ["Detail a."] },
    { "letter": "B", "name": "Beta", "loop": "around", "question": "B?",
      "raisedBy": { "kind": "census", "text": "the census" }, "packages": ["pkg-b", "shared"],
      "needs": "capture", "gates": "Phase 3", "entry": "rg -n 'b' .", "detail": ["Detail b."] }
  ],
  "infrastructurePackages": ["util"],
  "transferLedger": [{ "q": "Does it log?", "available": true, "source": "logs" }],
  "log": [
    { "thread": "A", "date": "2026-01-02", "finding": "Found a.", "surprising": true,
      "note": "notes/A-alpha.md", "opened": [{ "id": "q1", "q": "Why b?", "ask": "B" }],
      "resolved": [], "issue": null },
    { "thread": "A", "date": "2026-01-03", "finding": "Dull.", "surprising": false,
      "note": "notes/A-alpha.md", "opened": [], "resolved": [], "issue": null }
  ]
}
```

Create both note files with one line of content each:

```bash
mkdir -p tools/campaign/fixtures/mini/notes
printf '# Alpha\n' > tools/campaign/fixtures/mini/notes/A-alpha.md
printf '# Beta\n'  > tools/campaign/fixtures/mini/notes/B-beta.md
```

- [ ] **Step 2: Write the failing test**

Create `tools/campaign/model.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCampaign } from './model.mjs'

const MINI = 'tools/campaign/fixtures/mini'
const clone = () => structuredClone(readCampaign(MINI))

test('reads the mini campaign', () => {
  const d = readCampaign(MINI)
  assert.equal(d.campaign, 'mini')
  assert.equal(d.threads.length, 2)
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tools/campaign/model.test.mjs`
Expected: FAIL — `Cannot find module './model.mjs'`.

- [ ] **Step 4: Implement `readCampaign`**

```javascript
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const LETTERS = 'ABCDEFGHIJKLMNO'

// `override` exists so tests can validate mutated data without writing files.
export function readCampaign(dir, override) {
  const data = override ?? JSON.parse(readFileSync(join(dir, 'campaign.json'), 'utf8'))
  const fail = (msg) => { throw new Error(`${dir}/campaign.json: ${msg}`) }

  const loops = new Set(data.loopSteps.map((s) => s.id))
  const seen = new Set()
  for (const t of data.threads) {
    if (!LETTERS.includes(t.letter) || t.letter.length !== 1) fail(`thread letter ${t.letter} is not in A-O`)
    if (seen.has(t.letter)) fail(`duplicate thread letter ${t.letter}`)
    seen.add(t.letter)
    if (!loops.has(t.loop)) fail(`thread ${t.letter} names unknown loop step ${t.loop}`)
  }

  const openedIds = new Set()
  for (const e of data.log) for (const o of e.opened) openedIds.add(o.id)

  data.log.forEach((e, i) => {
    if (!seen.has(e.thread)) fail(`log[${i}].thread ${e.thread} is not a known thread`)
    if (Number.isNaN(Date.parse(e.date))) fail(`log[${i}].date ${e.date} is not a parseable date`)
    if (!existsSync(join(dir, e.note))) fail(`log[${i}].note ${e.note} does not exist`)
    for (const o of e.opened)
      if (!seen.has(o.ask)) fail(`log[${i}] opened "${o.id}" asks unknown thread ${o.ask}`)
    for (const id of e.resolved)
      if (!openedIds.has(id)) fail(`log[${i}] resolves "${id}", which was never opened`)
  })

  return { ...data, dir }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tools/campaign/model.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add tools/campaign/model.mjs tools/campaign/model.test.mjs tools/campaign/fixtures/mini/
git commit -m "feat: load and validate campaign.json"
```

---

## Task 4: Derive computed state

Every value the pages display that a reader could work out for themselves.

**Files:**
- Modify: `tools/campaign/model.mjs` (append)
- Test: `tools/campaign/derive.test.mjs`

**Interfaces:**
- Consumes: `readCampaign(dir) → data`.
- Produces:
  - `derive(data) → derived`, where `derived` is
    `{ threads: Map<letter, {letter, state, run, pips, entries, issue, lastDate}>, totals: {touched, dry, notStarted}, live: string[], frontier: [{id,q,ask,from,date}], trail: [{...entry, pips, thread}], edges: [{from,to,label,kind}], census: [{letter,name,loop,needs,packages}] }`
  - `state` is `'not-started' | 'live' | 'dry'`; `run` is the trailing count of unsurprising findings; `pips` is a string of `surpriseBudget` characters using `●` and `○`.
  - `loadCampaign(dir) → { data, derived }`.

- [ ] **Step 1: Write the failing test**

Create `tools/campaign/derive.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCampaign, derive, loadCampaign } from './model.mjs'

const MINI = 'tools/campaign/fixtures/mini'
const withLog = (log) => derive({ ...readCampaign(MINI), log })

test('an untouched thread is not-started with no pips filled', () => {
  const d = derive(readCampaign(MINI))
  assert.equal(d.threads.get('B').state, 'not-started')
  assert.equal(d.threads.get('B').pips, '○○')
})

test('one unsurprising finding fills one pip and stays live', () => {
  const t = derive(readCampaign(MINI)).threads.get('A')
  assert.equal(t.state, 'live')
  assert.equal(t.run, 1)
  assert.equal(t.pips, '●○')
})

test('two consecutive unsurprising findings go dry', () => {
  const base = readCampaign(MINI).log
  const t = withLog([...base, { thread: 'A', date: '2026-01-04', finding: 'Also dull.',
    surprising: false, note: 'notes/A-alpha.md', opened: [], resolved: [], issue: 9 }])
    .threads.get('A')
  assert.equal(t.state, 'dry')
  assert.equal(t.pips, '●●')
  assert.equal(t.issue, 9)
})

test('a surprising finding resets the run', () => {
  const base = readCampaign(MINI).log
  const t = withLog([...base, { thread: 'A', date: '2026-01-04', finding: 'Surprising!',
    surprising: true, note: 'notes/A-alpha.md', opened: [], resolved: [], issue: null }])
    .threads.get('A')
  assert.equal(t.run, 0)
  assert.equal(t.state, 'live')
  assert.equal(t.pips, '○○')
})

test('entries are replayed in date order regardless of array order', () => {
  const t = withLog([
    { thread: 'A', date: '2026-01-03', finding: 'Dull.', surprising: false,
      note: 'notes/A-alpha.md', opened: [], resolved: [], issue: null },
    { thread: 'A', date: '2026-01-02', finding: 'Found a.', surprising: true,
      note: 'notes/A-alpha.md', opened: [], resolved: [], issue: null },
  ]).threads.get('A')
  assert.equal(t.run, 1)
})

test('totals count touched, dry, and not-started', () => {
  assert.deepEqual(derive(readCampaign(MINI)).totals, { touched: 1, dry: 0, notStarted: 1 })
})

test('an open question appears in the frontier', () => {
  const f = derive(readCampaign(MINI)).frontier
  assert.equal(f.length, 1)
  assert.deepEqual({ id: f[0].id, from: f[0].from, ask: f[0].ask }, { id: 'q1', from: 'A', ask: 'B' })
})

test('a resolved question leaves the frontier', () => {
  const base = readCampaign(MINI).log
  const d = withLog([...base, { thread: 'B', date: '2026-01-05', finding: 'Answered.',
    surprising: true, note: 'notes/B-beta.md', opened: [], resolved: ['q1'], issue: null }])
  assert.deepEqual(d.frontier, [])
})

test('the trail is newest first and carries pips at that point', () => {
  const t = derive(readCampaign(MINI)).trail
  assert.equal(t[0].date, '2026-01-03')
  assert.equal(t[0].pips, '●○')
  assert.equal(t[1].pips, '○○')
})

test('live lists live threads most-recently-touched first', () => {
  assert.deepEqual(derive(readCampaign(MINI)).live, ['A'])
})

test('edges come from opened questions and from gates', () => {
  const e = derive(readCampaign(MINI)).edges
  assert.ok(e.some((x) => x.from === 'A' && x.to === 'B' && x.kind === 'opened'))
  assert.ok(e.some((x) => x.from === 'B' && x.to === 'Phase 3' && x.kind === 'gates'))
})

test('census carries every thread with its packages', () => {
  const c = derive(readCampaign(MINI)).census
  assert.equal(c.length, 2)
  assert.deepEqual(c[0].packages, ['pkg-a', 'shared'])
})

test('loadCampaign returns data and derived together', () => {
  const { data, derived } = loadCampaign(MINI)
  assert.equal(data.campaign, 'mini')
  assert.equal(derived.threads.size, 2)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/derive.test.mjs`
Expected: FAIL — `derive is not a function`.

- [ ] **Step 3: Implement `derive` and `loadCampaign`**

Append to `tools/campaign/model.mjs`:

```javascript
const pipsFor = (run, budget) => '●'.repeat(Math.min(run, budget)) + '○'.repeat(Math.max(budget - run, 0))

export function derive(data) {
  const budget = data.surpriseBudget
  const byDate = [...data.log].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))

  const threads = new Map()
  for (const t of data.threads)
    threads.set(t.letter, { ...t, state: 'not-started', run: 0, pips: pipsFor(0, budget), entries: [], issue: null, lastDate: null })

  const trail = []
  for (const e of byDate) {
    const t = threads.get(e.thread)
    t.run = e.surprising ? 0 : t.run + 1
    t.lastDate = e.date
    if (e.issue != null) t.issue = e.issue
    const stamped = { ...e, pips: pipsFor(t.run, budget) }
    t.entries.push(stamped)
    trail.push(stamped)
  }

  for (const t of threads.values()) {
    if (t.entries.length === 0) continue
    t.state = t.run >= budget ? 'dry' : 'live'
    t.pips = pipsFor(t.run, budget)
  }

  const resolved = new Set(byDate.flatMap((e) => e.resolved))
  const frontier = byDate.flatMap((e) => e.opened.map((o) => ({ ...o, from: e.thread, date: e.date })))
    .filter((o) => !resolved.has(o.id))

  const edges = [
    ...byDate.flatMap((e) => e.opened.map((o) => ({ from: e.thread, to: o.ask, label: o.q, kind: 'opened' }))),
    ...data.threads.filter((t) => t.gates).map((t) => ({ from: t.letter, to: t.gates, label: 'gates', kind: 'gates' })),
  ]

  const list = [...threads.values()]
  return {
    threads,
    totals: {
      touched: list.filter((t) => t.state !== 'not-started').length,
      dry: list.filter((t) => t.state === 'dry').length,
      notStarted: list.filter((t) => t.state === 'not-started').length,
    },
    live: list.filter((t) => t.state === 'live')
      .sort((a, b) => Date.parse(b.lastDate) - Date.parse(a.lastDate)).map((t) => t.letter),
    frontier,
    trail: trail.reverse(),
    edges,
    census: data.threads.map(({ letter, name, loop, needs, packages }) => ({ letter, name, loop, needs, packages })),
  }
}

export function loadCampaign(dir) {
  const data = readCampaign(dir)
  return { data, derived: derive(data) }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/campaign/derive.test.mjs`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/campaign/model.mjs tools/campaign/derive.test.mjs
git commit -m "feat: derive surprise state, frontier, totals, edges, and census"
```

---

## Task 5: The shared theme

**Files:**
- Create: `tools/campaign/theme.mjs`
- Test: `tools/campaign/theme.test.mjs`

**Interfaces:**
- Consumes: `checkHtml` from `./checks.mjs`.
- Produces: `CSS` — a string containing a complete `<style>…</style>` block, including the three-state theme tokens and every class used by all three renderers.

- [ ] **Step 1: Write the failing test**

Create `tools/campaign/theme.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CSS } from './theme.mjs'
import { checkHtml } from './checks.mjs'

const PAGE = `<meta charset="utf-8">\n${CSS}\n<div id="x"></div>`

test('the theme alone satisfies the HTML property checks', () => {
  assert.deepEqual(checkHtml(PAGE), [])
})

test('all three theme states are present', () => {
  assert.match(CSS, /@media \(prefers-color-scheme: dark\)/)
  assert.match(CSS, /:root:not\(\[data-theme="light"\]\)/)
  assert.match(CSS, /:root\[data-theme="dark"\]/)
})

test('every token redefined in a dark block also exists in the bare :root', () => {
  const bare = new Set([...CSS.match(/:root\s*\{([^}]*)\}/)[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  const after = CSS.slice(CSS.indexOf('@media'))
  for (const m of after.matchAll(/(--[a-z0-9-]+)\s*:/g))
    assert.ok(bare.has(m[1]), `${m[1]} is redefined in a theme block but missing from the bare :root`)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/theme.test.mjs`
Expected: FAIL — `Cannot find module './theme.mjs'`.

- [ ] **Step 3: Implement `theme.mjs`**

Copy the entire `<style>…</style>` block from `tools/campaign/fixtures/roadmap-premigration.html` — **lines 3 through 215 inclusive**, `<style>` and `</style>` included — into an exported template literal, then append the worklog-only classes below it.

```bash
sed -n '3,215p' tools/campaign/fixtures/roadmap-premigration.html | head -3   # sanity: starts at <style>
sed -n '3,215p' tools/campaign/fixtures/roadmap-premigration.html | rg -c '`|\$\{' || echo "safe to embed"
```

The second command must print `safe to embed`. If it ever prints a count, escape those backticks and `${` sequences before embedding, or the template literal will break.

```javascript
export const CSS = `<style>
  /* --- verbatim from the pre-migration roadmap: tokens, three theme states,
         masthead, sections, code, loop figure, grids, schema, board, bands,
         threads, tables, footer --- */

  /* --- worklog additions --- */
  .strip { position: sticky; top: 0; z-index: 5; background: var(--head);
           border: 1px solid var(--rule); padding: 10px 14px; margin-bottom: 22px; }
  .strip-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: baseline; }
  .strip-band { display: flex; gap: 5px; align-items: baseline; }
  .strip-label { font-family: var(--mono); font-size: 9.5px; letter-spacing: .13em;
                 text-transform: uppercase; color: var(--ink-faint); }
  .pip { font-family: var(--mono); font-size: 12px; border: 1px solid var(--rule);
         padding: 1px 6px; text-decoration: none; color: var(--ink); }
  .pip[data-state="not-started"] { border-style: dashed; opacity: .5; }
  .pip[data-state="live"] { border-color: var(--specimen); }
  .pip[data-state="dry"] { text-decoration: line-through; opacity: .6; }
  .frontier li { margin: 4px 0; }
  .entry { border-left: 3px solid var(--rule); padding: 6px 0 6px 12px; margin-bottom: 12px; }
  .entry[data-state="dry"] { opacity: .6; }
</style>`
```

The comment placeholders above mark where the copied CSS goes — **the copied CSS must be present in full**, not summarised. Verify with Step 4; the token test fails immediately if any block is missing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/campaign/theme.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/campaign/theme.mjs tools/campaign/theme.test.mjs
git commit -m "feat: shared theme block for all generated pages"
```

---

## Task 6: Render the roadmap

**Files:**
- Create: `tools/campaign/render-roadmap.mjs`
- Test: `tools/campaign/render-roadmap.test.mjs`

**Interfaces:**
- Consumes: `loadCampaign(dir)`, `CSS`, `esc`/`rich`/`attr`, `checkHtml`.
- Produces: `renderRoadmap({ data, derived }) → string` — a complete HTML page.

- [ ] **Step 1: Write the failing test**

Create `tools/campaign/render-roadmap.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { renderRoadmap } from './render-roadmap.mjs'
import { checkHtml } from './checks.mjs'

const html = renderRoadmap(loadCampaign('tools/campaign/fixtures/mini'))

test('passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})

test('emits an anchor per thread', () => {
  assert.match(html, /id="tA"/)
  assert.match(html, /id="tB"/)
})

test('links each thread to its worklog entry', () => {
  assert.match(html, /href="worklog\.html#tA"/)
})

test('emits no state chips', () => {
  assert.doesNotMatch(html, /c-state/)
  assert.doesNotMatch(html, /not started/)
})

test('escapes shell metacharacters in entry commands', () => {
  assert.match(html, /rg -n &#39;a&#39; \./)
})

test('census and thread cards read the same package array', () => {
  const cards = [...html.matchAll(/class="pkg">([^<]+)</g)].map((m) => m[1])
  assert.ok(cards.includes('shared'))
  assert.match(html, /pkg-a · shared/)
})

test('a census-raised thread is marked as such', () => {
  assert.match(html, /the census/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/render-roadmap.test.mjs`
Expected: FAIL — `Cannot find module './render-roadmap.mjs'`.

- [ ] **Step 3: Implement `render-roadmap.mjs`**

Port the markup from `tools/campaign/fixtures/roadmap-premigration.html` section by section, substituting data. Structure:

```javascript
import { CSS } from './theme.mjs'
import { esc, rich, attr } from './html.mjs'

const nav = (data) => /* §1–§8 links plus one link per thread, grouped by loop step */ ''
const masthead = (data, derived) => ''
const sLoop = (data) => ''      // §1: loop SVG + claims from data.copy.claims
const sMap = (data) => ''       // §2: the dependency schematic
const sBoard = (data) => ''     // §3: phase lanes — NO c-state chips
const sMenu = (data, derived) => ''  // §4: five bands; each card links to worklog.html#tX
const sWhy = (data) => ''       // §5: question index from threads[].raisedBy
const sTransfer = (data) => ''  // §6: from data.transferLedger
const sOrders = (data) => ''    // §7: from data.copy.standingOrders + canonicalTask
const sCensus = (derived) => '' // §8: from derived.census + infrastructurePackages
const footer = (data) => ''

export function renderRoadmap({ data, derived }) {
  return [
    '<meta charset="utf-8">',
    `<title>${esc(data.title)}</title>`,
    CSS,
    '<div class="page"><div class="cols">',
    nav(data), '<main>',
    masthead(data, derived),
    sLoop(data), sMap(data), sBoard(data), sMenu(data, derived),
    sWhy(data), sTransfer(data), sOrders(data), sCensus(derived),
    footer(data),
    '</main></div></div>',
  ].join('\n')
}
```

Each `s*` function returns the corresponding section's markup with values interpolated through `esc`, `rich`, or `attr`. Use `rich` for `question`, `detail`, `copy.*`, and loop-step questions; `esc` for `entry`, package names, letters, and names; `attr` inside attribute values.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/campaign/render-roadmap.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/campaign/render-roadmap.mjs tools/campaign/render-roadmap.test.mjs
git commit -m "feat: render roadmap.html from campaign data"
```

---

## Task 7: The CLI

**Files:**
- Create: `tools/build-campaign.mjs`
- Test: `tools/campaign/cli.test.mjs`

**Interfaces:**
- Consumes: `loadCampaign`, `renderRoadmap`.
- Produces: executable `node tools/build-campaign.mjs <campaign> [--check]` and `--all [--check]`. Exit 0 clean, exit 1 on drift or validation failure. `renderWorklog` and `renderBoard` are wired in by Tasks 9 and 11; until then the CLI writes the roadmap only.

- [ ] **Step 1: Write the failing test**

Create `tools/campaign/cli.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (args, opts = {}) =>
  execFileSync('node', ['tools/build-campaign.mjs', ...args], { encoding: 'utf8', ...opts })

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'campaign-'))
  cpSync('tools', join(dir, 'tools'), { recursive: true })
  cpSync('tools/campaign/fixtures/mini', join(dir, 'campaigns/mini'), { recursive: true })
  return dir
}

test('writes roadmap.html for a campaign', () => {
  const cwd = sandbox()
  run(['mini'], { cwd })
  assert.match(readFileSync(join(cwd, 'campaigns/mini/roadmap.html'), 'utf8'), /<meta charset="utf-8">/)
})

test('--check passes immediately after a build', () => {
  const cwd = sandbox()
  run(['mini'], { cwd })
  assert.doesNotThrow(() => run(['mini', '--check'], { cwd }))
})

test('--check fails when the committed page has drifted', () => {
  const cwd = sandbox()
  run(['mini'], { cwd })
  const p = join(cwd, 'campaigns/mini/roadmap.html')
  writeFileSync(p, readFileSync(p, 'utf8').replace('Alpha', 'Tampered'))
  assert.throws(() => run(['mini', '--check'], { cwd }), /drift/i)
})

test('a validation error exits non-zero and names the field', () => {
  const cwd = sandbox()
  const p = join(cwd, 'campaigns/mini/campaign.json')
  const d = JSON.parse(readFileSync(p, 'utf8'))
  d.log[0].thread = 'Q'
  writeFileSync(p, JSON.stringify(d))
  assert.throws(() => run(['mini'], { cwd }), /log\[0\]\.thread/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/cli.test.mjs`
Expected: FAIL — `Cannot find module '.../tools/build-campaign.mjs'`.

- [ ] **Step 3: Implement the CLI**

```javascript
#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadCampaign } from './campaign/model.mjs'
import { renderRoadmap } from './campaign/render-roadmap.mjs'

const args = process.argv.slice(2)
const check = args.includes('--check')
const all = args.includes('--all')
const named = args.filter((a) => !a.startsWith('--'))

const campaigns = all
  ? readdirSync('campaigns', { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join('campaigns', d.name, 'campaign.json')))
      .map((d) => d.name)
  : named

if (campaigns.length === 0) {
  console.error('usage: node tools/build-campaign.mjs <campaign> [--check] | --all [--check]')
  process.exit(1)
}

let drifted = 0
for (const name of campaigns) {
  const dir = join('campaigns', name)
  const model = loadCampaign(dir)
  for (const [file, html] of [['roadmap.html', renderRoadmap(model)]]) {
    const path = join(dir, file)
    if (check) {
      const current = existsSync(path) ? readFileSync(path, 'utf8') : ''
      if (current !== html) { console.error(`drift: ${path} does not match its data`); drifted++ }
    } else {
      writeFileSync(path, html)
      console.log(`wrote ${path}`)
    }
  }
}
process.exit(drifted > 0 ? 1 : 0)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/campaign/cli.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/build-campaign.mjs tools/campaign/cli.test.mjs
git commit -m "feat: build-campaign CLI with drift checking"
```

---

## Task 8: Transcribe the real roadmap into `campaign.json`

The one hand-transcription in the plan, and the only task whose failure mode is silent data loss. Everything before it exists to catch that.

**Files:**
- Create: `campaigns/agent-harnesses/campaign.json`
- Modify: `campaigns/agent-harnesses/roadmap.html` (regenerated)
- Test: `tools/campaign/acceptance.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: real campaign data conforming to the schema in the spec's "Data model" section.

- [ ] **Step 1: Write the failing acceptance test**

Create `tools/campaign/acceptance.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadCampaign } from './model.mjs'
import { renderRoadmap } from './render-roadmap.mjs'
import { checkHtml } from './checks.mjs'

const SNAP = readFileSync('tools/campaign/fixtures/roadmap-premigration.html', 'utf8')
const html = renderRoadmap(loadCampaign('campaigns/agent-harnesses'))

test('every acceptance phrase survives the migration', () => {
  const phrases = readFileSync('tools/campaign/fixtures/acceptance-phrases.txt', 'utf8')
    .split('\n').filter(Boolean)
  const missing = phrases.filter((p) => !html.includes(p))
  assert.deepEqual(missing, [])
})

test('every package named in the snapshot survives', () => {
  const pkgs = new Set([...SNAP.matchAll(/<span class="pkg">([^<]+)<\/span>/g)].map((m) => m[1]))
  assert.ok(pkgs.size >= 40, `snapshot yielded only ${pkgs.size} packages`)
  const missing = [...pkgs].filter((p) => !html.includes(p))
  assert.deepEqual(missing, [])
})

test('all fifteen threads are present', () => {
  for (const l of 'ABCDEFGHIJKLMNO') assert.match(html, new RegExp(`id="t${l}"`))
})

test('the generated page passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/acceptance.test.mjs`
Expected: FAIL — `ENOENT: campaigns/agent-harnesses/campaign.json`.

- [ ] **Step 3: Transcribe**

Create `campaigns/agent-harnesses/campaign.json` following the spec's schema. Source every value from `tools/campaign/fixtures/roadmap-premigration.html`. Transcription rules:

- Store **literal characters**, never HTML entities: write `Tools & permission`, not `Tools &amp; permission`; `→`, not `&rarr;`. `esc`/`rich` add the entities.
- Keep the inline allowlist tags (`<b> <i> <em> <strong> <code>`) inside `question`, `detail`, and `copy` strings; they pass through `rich`.
- `raisedBy.kind` is `"census"` for M and N only; `"toy"` for the other thirteen.
- `needs` is `"capture"` for A and C, `"note-2.0"` for B, `"source"` for the other twelve.
- `gates` is `"Phase 3"` for D, `null` for everything else.
- `log` starts as `[]`. No findings exist yet.
- `infrastructurePackages` is `["util", "typert", "test-support", "bundle"]`.

- [ ] **Step 4: Regenerate and run the acceptance test**

```bash
node tools/build-campaign.mjs agent-harnesses
node --test tools/campaign/acceptance.test.mjs
```

Expected: PASS, 4 tests. On a missing-phrase failure, the message names the phrase — find its section in the snapshot and add the data it came from. **Never edit `acceptance-phrases.txt` to make this pass.**

- [ ] **Step 5: Review the visual diff by eye**

```bash
open campaigns/agent-harnesses/roadmap.html
open tools/campaign/fixtures/roadmap-premigration.html
```

The pages should differ in exactly two visible ways: the six `not started` chips are gone, and each thread card has a `→ worklog` link. Anything else is a transcription defect.

- [ ] **Step 6: Commit**

```bash
git add campaigns/agent-harnesses/campaign.json campaigns/agent-harnesses/roadmap.html tools/campaign/acceptance.test.mjs
git commit -m "feat: generate the agent-harnesses roadmap from campaign.json"
```

---

## Task 9: Render the worklog

**Files:**
- Create: `tools/campaign/render-worklog.mjs`
- Modify: `tools/build-campaign.mjs` (add worklog to the output list)
- Test: `tools/campaign/render-worklog.test.mjs`

**Interfaces:**
- Consumes: `loadCampaign`, `CSS`, `esc`/`rich`/`attr`, `checkHtml`.
- Produces: `renderWorklog({ data, derived }) → string`.

- [ ] **Step 1: Write the failing test**

Create `tools/campaign/render-worklog.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { renderWorklog } from './render-worklog.mjs'
import { checkHtml } from './checks.mjs'

const html = renderWorklog(loadCampaign('tools/campaign/fixtures/mini'))

test('passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})

test('the coverage strip is sticky', () => {
  assert.match(html, /class="strip"/)
})

test('the strip carries totals and a live index', () => {
  assert.match(html, /1 touched · 0 dry · 1 not started/)
  assert.match(html, /live · A/)
})

test('letters are in fixed alphabetical order within a band', () => {
  const band = html.match(/data-band="assemble"[\s\S]*?<\/div>/)[0]
  assert.match(band, />A</)
})

test('thread state drives the pip attribute', () => {
  assert.match(html, /data-state="live"[^>]*>A/)
  assert.match(html, /data-state="not-started"[^>]*>B/)
})

test('the frontier lists open questions with from and ask', () => {
  assert.match(html, /Why b\?/)
  assert.match(html, /from A/)
  assert.match(html, /ask B/)
})

test('the trail is newest first', () => {
  assert.ok(html.indexOf('Dull.') < html.indexOf('Found a.'))
})

test('entries link to their note and back to the roadmap', () => {
  assert.match(html, /notes\/A-alpha\.md/)
  assert.match(html, /href="roadmap\.html#tA"/)
})

test('anchors exist for every thread', () => {
  assert.match(html, /id="tA"/)
  assert.match(html, /id="tB"/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/render-worklog.test.mjs`
Expected: FAIL — `Cannot find module './render-worklog.mjs'`.

- [ ] **Step 3: Implement `render-worklog.mjs`**

```javascript
import { CSS } from './theme.mjs'
import { esc, rich, attr } from './html.mjs'

const strip = (data, derived) => {
  const bands = data.loopSteps.map((step) => {
    const letters = data.threads.filter((t) => t.loop === step.id)
      .sort((a, b) => a.letter.localeCompare(b.letter))
      .map((t) => {
        const d = derived.threads.get(t.letter)
        return `<a class="pip" data-state="${attr(d.state)}" href="#t${esc(t.letter)}" `
             + `title="${attr(t.name)}">${esc(t.letter)} ${esc(d.pips)}</a>`
      }).join('')
    return `<div class="strip-band" data-band="${attr(step.id)}">`
         + `<span class="strip-label">${esc(step.label)}</span>${letters}</div>`
  }).join('')
  const { touched, dry, notStarted } = derived.totals
  const live = derived.live.length ? `live · ${derived.live.map(esc).join(' ')}` : 'live · none'
  return `<div class="strip"><div class="strip-label">`
       + `${touched} touched · ${dry} dry · ${notStarted} not started &nbsp; ${live}`
       + `</div><div class="strip-row">${bands}</div></div>`
}

const frontier = (derived) => derived.frontier.length === 0
  ? '<p class="lede">No open questions. The next thread is a fresh pick.</p>'
  : `<ul class="frontier">${derived.frontier.map((q) =>
      `<li>${rich(q.q)} <span class="mono">from ${esc(q.from)} → ask ${esc(q.ask)}</span></li>`).join('')}</ul>`

const trail = (data, derived) => derived.trail.map((e) => {
  const t = derived.threads.get(e.thread)
  const state = t.state === 'dry' && e === t.entries.at(-1) ? 'dry' : 'live'
  const opened = e.opened.map((o) => `→ opened: ${rich(o.q)} (${esc(o.ask)})`).join('<br>')
  const issue = e.issue != null ? ` · filed #${esc(String(e.issue))}` : ''
  return `<div class="entry" data-state="${attr(state)}" id="e-${attr(e.thread + e.date)}">`
       + `<b><a href="roadmap.html#t${esc(e.thread)}">${esc(e.thread)} · ${esc(t.name)}</a></b> `
       + `<span class="mono">${esc(e.pips)} ${esc(e.date)}</span><br>${rich(e.finding)}<br>`
       + `<span class="mono">${opened}${opened ? ' · ' : ''}${esc(e.note)}${issue}</span></div>`
}).join('\n')

const anchors = (data) => data.threads
  .map((t) => `<span id="t${attr(t.letter)}"></span>`).join('')

export function renderWorklog({ data, derived }) {
  return [
    '<meta charset="utf-8">',
    `<title>${esc(data.title)} · Worklog</title>`,
    CSS,
    '<div class="page"><main>',
    `<header class="mast"><p class="kick">Worklog · ${esc(data.campaign)}</p>`,
    `<h1>${esc(data.title)} · what has happened</h1></header>`,
    strip(data, derived),
    '<section><h2 class="sec">Open questions</h2>', frontier(derived), '</section>',
    '<section><h2 class="sec">Trail</h2>', anchors(data), trail(data, derived), '</section>',
    `<footer><span><a href="roadmap.html">← roadmap</a></span>`,
    `<span><a href="../index.html">all campaigns</a></span></footer>`,
    '</main></div>',
  ].join('\n')
}
```

- [ ] **Step 4: Wire it into the CLI**

In `tools/build-campaign.mjs`, add the import and extend the output list:

```javascript
import { renderWorklog } from './campaign/render-worklog.mjs'
// …
for (const [file, html] of [
  ['roadmap.html', renderRoadmap(model)],
  ['worklog.html', renderWorklog(model)],
]) {
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tools/campaign/`
Expected: PASS, all suites.

- [ ] **Step 6: Generate the real worklog and commit**

```bash
node tools/build-campaign.mjs agent-harnesses
open campaigns/agent-harnesses/worklog.html
git add tools/campaign/render-worklog.mjs tools/campaign/render-worklog.test.mjs \
        tools/build-campaign.mjs campaigns/agent-harnesses/worklog.html
git commit -m "feat: render worklog.html with sticky coverage strip, frontier, and trail"
```

With an empty log the page should show fifteen dashed letters, `0 touched · 0 dry · 15 not started`, `live · none`, and the empty-frontier line. An empty worklog is how "not started" is expressed now — no chip claims it.

---

## Task 10: The thread graph

**Files:**
- Create: `tools/campaign/graph.mjs`
- Modify: `tools/campaign/render-worklog.mjs` (insert the graph under the strip)
- Test: `tools/campaign/graph.test.mjs`

**Interfaces:**
- Consumes: `derived.edges`, `derived.threads`, `data.loopSteps`, `data.threads`.
- Produces: `renderGraph({ data, derived }) → string` — an `<svg>` element, empty string when there are no edges.

- [ ] **Step 1: Write the failing test**

Create `tools/campaign/graph.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { renderGraph } from './graph.mjs'

const model = loadCampaign('tools/campaign/fixtures/mini')

test('emits one node per thread', () => {
  const svg = renderGraph(model)
  assert.equal([...svg.matchAll(/class="gnode"/g)].length, 2)
})

test('emits one path per edge', () => {
  const svg = renderGraph(model)
  assert.equal([...svg.matchAll(/class="gedge"/g)].length, model.derived.edges.length)
})

test('nodes carry their state for styling', () => {
  assert.match(renderGraph(model), /data-state="not-started"/)
})

test('an empty log yields no graph at all', () => {
  const empty = { ...model, derived: { ...model.derived, edges: [] } }
  assert.equal(renderGraph(empty), '')
})

test('the svg has no external references', () => {
  assert.doesNotMatch(renderGraph(model), /<script|href="http/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/graph.test.mjs`
Expected: FAIL — `Cannot find module './graph.mjs'`.

- [ ] **Step 3: Implement `graph.mjs`**

Lay nodes on a grid: one column per loop step, threads stacked down each column in alphabetical order. Draw edges as quadratic curves between node centres.

```javascript
import { esc, attr } from './html.mjs'

const COL = 170, ROW = 46, PAD = 26, W = 62, H = 26

export function renderGraph({ data, derived }) {
  if (derived.edges.length === 0) return ''

  const pos = new Map()
  data.loopSteps.forEach((step, col) => {
    data.threads.filter((t) => t.loop === step.id)
      .sort((a, b) => a.letter.localeCompare(b.letter))
      .forEach((t, row) => pos.set(t.letter, { x: PAD + col * COL, y: PAD + row * ROW }))
  })

  const rows = Math.max(...data.loopSteps.map((s) => data.threads.filter((t) => t.loop === s.id).length))
  const width = PAD * 2 + (data.loopSteps.length - 1) * COL + W
  const height = PAD * 2 + rows * ROW

  const edges = derived.edges.filter((e) => pos.has(e.from) && pos.has(e.to)).map((e) => {
    const a = pos.get(e.from), b = pos.get(e.to)
    const [x1, y1] = [a.x + W, a.y + H / 2]
    const [x2, y2] = [b.x, b.y + H / 2]
    const mx = (x1 + x2) / 2
    return `<path class="gedge" d="M${x1},${y1} Q${mx},${y1} ${mx},${(y1 + y2) / 2} T${x2},${y2}" `
         + `fill="none" stroke="currentColor" stroke-width="1" opacity=".45" marker-end="url(#gar)">`
         + `<title>${esc(e.label)}</title></path>`
  }).join('')

  const nodes = [...pos.entries()].map(([letter, p]) => {
    const d = derived.threads.get(letter)
    return `<g class="gnode" data-state="${attr(d.state)}">`
         + `<rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" fill="none" stroke="currentColor" `
         + `stroke-dasharray="${d.state === 'not-started' ? '3 3' : '0'}"/>`
         + `<text x="${p.x + W / 2}" y="${p.y + 17}" text-anchor="middle" font-size="12" `
         + `fill="currentColor" font-family="ui-monospace, Menlo, monospace">`
         + `${esc(letter)} ${esc(d.pips)}</text></g>`
  }).join('')

  const labels = data.loopSteps.map((s, col) =>
    `<text x="${PAD + col * COL}" y="14" font-size="9" fill="currentColor" opacity=".6" `
    + `font-family="ui-monospace, Menlo, monospace">${esc(s.label.toUpperCase())}</text>`).join('')

  return `<figure class="loop"><svg viewBox="0 0 ${width} ${height + 16}" role="img" `
       + `aria-label="Thread graph: which thread opened a question for which other thread.">`
       + `<defs><marker id="gar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" `
       + `orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`
       + `<g style="color:var(--ink-soft)">${labels}${edges}${nodes}</g></svg>`
       + `<figcaption>An edge is a question one thread opened for another.</figcaption></figure>`
}
```

- [ ] **Step 4: Insert it into the worklog**

In `tools/campaign/render-worklog.mjs`, import `renderGraph` and place it immediately after `strip(data, derived)` in the array returned by `renderWorklog`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tools/campaign/`
Expected: PASS, all suites. The worklog's `checkHtml` test still passes because `svg` is a paired tag it already counts.

- [ ] **Step 6: Commit**

```bash
git add tools/campaign/graph.mjs tools/campaign/graph.test.mjs tools/campaign/render-worklog.mjs
git commit -m "feat: generated thread-graph SVG on the worklog"
```

---

## Task 11: Render the campaign board

**Files:**
- Create: `tools/campaign/render-board.mjs`
- Modify: `tools/build-campaign.mjs` (write `campaigns/index.html` under `--all`)
- Test: `tools/campaign/render-board.test.mjs`

**Interfaces:**
- Consumes: an array of `{ data, derived }`.
- Produces: `renderBoard(models) → string`.

- [ ] **Step 1: Write the failing test**

Create `tools/campaign/render-board.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCampaign } from './model.mjs'
import { renderBoard } from './render-board.mjs'
import { checkHtml } from './checks.mjs'

const html = renderBoard([loadCampaign('tools/campaign/fixtures/mini')])

test('passes every HTML property check', () => {
  assert.deepEqual(checkHtml(html), [])
})

test('shows the three roles', () => {
  assert.match(html, /test subject/)
  assert.match(html, /spec/)
  assert.match(html, /other/)
})

test('shows the same totals wording as the worklog strip', () => {
  assert.match(html, /1 touched · 0 dry · 1 not started/)
})

test('shows the newest finding as the resume line', () => {
  assert.match(html, /Dull\./)
})

test('links to both roadmap and worklog', () => {
  assert.match(html, /href="mini\/roadmap\.html"/)
  assert.match(html, /href="mini\/worklog\.html"/)
})

test('a campaign with no findings says so instead of inventing one', () => {
  const m = loadCampaign('tools/campaign/fixtures/mini')
  const empty = { data: m.data, derived: { ...m.derived, trail: [], live: [] } }
  assert.match(renderBoard([empty]), /not started/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/campaign/render-board.test.mjs`
Expected: FAIL — `Cannot find module './render-board.mjs'`.

- [ ] **Step 3: Implement `render-board.mjs`**

```javascript
import { CSS } from './theme.mjs'
import { esc, rich, attr } from './html.mjs'

const card = ({ data, derived }) => {
  const { touched, dry, notStarted } = derived.totals
  const newest = derived.trail[0]
  const resume = newest
    ? `${rich(newest.finding)} <span class="mono">— ${esc(newest.thread)} · ${esc(newest.date)}</span>`
    : 'not started'
  return `<article class="cell"><h3>${esc(data.title)} <span class="mono">${esc(data.campaign)}</span></h3>
    <p>${rich(data.copy.standfirst)}</p>
    <dl class="roles">
      <div class="role"><dt>Subject</dt><dd>${esc(data.subject)}</dd></div>
      <div class="role"><dt>Specimen</dt><dd>${esc(data.specimen.name)} @ ${esc(data.specimen.pinned)}</dd></div>
      <div class="role"><dt>Transfer specimen</dt><dd>${esc(data.transferSpecimen.name)} · ${esc(data.transferSpecimen.via)}</dd></div>
    </dl>
    <p class="mono">${resume}</p>
    <p class="mono">${touched} touched · ${dry} dry · ${notStarted} not started</p>
    <p><a href="${attr(data.campaign)}/roadmap.html">roadmap</a> ·
       <a href="${attr(data.campaign)}/worklog.html">worklog</a></p></article>`
}

export function renderBoard(models) {
  return [
    '<meta charset="utf-8">',
    '<title>Campaign Board</title>',
    CSS,
    '<div class="page"><main>',
    '<header class="mast"><p class="kick">githubhy/study-harness · one campaign per subject</p>',
    '<h1>Campaign Board</h1></header>',
    `<section><div class="grid2">${models.map(card).join('')}</div></section>`,
    '<footer><span>map · CONTEXT-MAP.md</span><span>method · docs/adr/0001</span></footer>',
    '</main></div>',
  ].join('\n')
}
```

- [ ] **Step 4: Wire it into the CLI**

In `tools/build-campaign.mjs`, collect each `model` into an array during the loop, then after the loop:

```javascript
if (all) {
  const board = renderBoard(models)
  if (check) {
    if (readFileSync('campaigns/index.html', 'utf8') !== board) {
      console.error('drift: campaigns/index.html does not match its data'); drifted++
    }
  } else {
    writeFileSync('campaigns/index.html', board)
    console.log('wrote campaigns/index.html')
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tools/campaign/`
Expected: PASS, all suites.

- [ ] **Step 6: Generate everything and commit**

```bash
node tools/build-campaign.mjs --all
node tools/build-campaign.mjs --all --check    # expect exit 0
open campaigns/index.html
git add tools/campaign/render-board.mjs tools/campaign/render-board.test.mjs \
        tools/build-campaign.mjs campaigns/index.html
git commit -m "feat: generate the campaign board from campaign data"
```

---

## Task 12: Document the workflow and retire the samples

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/agents/domain.md:24-32` (the `campaigns/` subtree inside the fenced block at lines 17–32)
- Delete: `campaigns/agent-harnesses/roadmap-samples/`
- Test: manual verification commands below

**Interfaces:**
- Consumes: the working CLI.
- Produces: nothing code-level; this task makes the workflow discoverable.

- [ ] **Step 1: Add the build contract to `CLAUDE.md`**

Insert after the `## Campaigns` section:

```markdown
## Generated pages

`roadmap.html`, `worklog.html`, and `campaigns/index.html` are **generated**. Never hand-edit them —
edit `campaigns/<name>/campaign.json` and rebuild:

    node tools/build-campaign.mjs --all
    node tools/build-campaign.mjs --all --check   # exits 1 if a page has drifted from its data
    node --test tools/campaign/                   # the generator's own tests

Logging a finding is: write `notes/<LETTER>-<slug>.md`, append one entry to `campaign.json`'s `log`,
rebuild, and commit all of it together. Surprise pips, dry detection, the frontier, totals, the
thread graph, and the package census are all derived — never write them by hand.
```

- [ ] **Step 2: Update the campaign layout in `docs/agents/domain.md`**

In the directory tree, add the generated files and the data file:

```
    └── agent-harnesses/
        ├── CONTEXT.md                 ← this campaign's vocabulary
        ├── campaign.json              ← source of truth for the pages below
        ├── roadmap.html               ← generated; do not hand-edit
        ├── worklog.html               ← generated; do not hand-edit
        ├── plan.md
        ├── docs/adr/
        └── notes/ captures/ experiments/
```

- [ ] **Step 3: Delete the superseded layout samples**

These three files were the candidates that produced the current design. They are superseded, and they
carry stale paths (`docs/roadmap.html`, `docs/superpowers/plans/…`) that pollute repo-wide greps.

```bash
git rm -r campaigns/agent-harnesses/roadmap-samples/
```

- [ ] **Step 4: Verify no stale references remain**

```bash
rg -n 'docs/roadmap\.html|docs/roadmap-samples|roadmap-samples' --glob '!.superpowers' . || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Full verification sweep**

```bash
node --test tools/campaign/                    # all suites pass
node tools/build-campaign.mjs --all --check    # exit 0
git status --short                             # nothing unexpected
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/agents/domain.md
git commit -m "docs: record the generated-pages workflow and retire the layout samples"
```

---

## Self-Review

**Spec coverage.** Data model → Tasks 3, 8. Derived values → Task 4. Generator layout, CLI, validation
list → Tasks 3, 7. Guaranteed-by-construction properties → Tasks 1, 5, and every render test.
Worklog strip / live index / frontier / trail → Task 9. Thread graph → Task 10. Roadmap changes
(chips removed, worklog links, §5 and §8 from `threads[]`) → Tasks 6, 8. Board → Task 11. Update loop
→ Task 12. Verification and migration acceptance → Tasks 1, 7, 8. Deferred items are correctly absent,
except `roadmap-samples/`, whose deletion the user approved during the brainstorm and which Task 12
carries out.

**Known gap, accepted.** Task 6 gives the roadmap renderer's section functions as named stubs with
their responsibilities and data sources, rather than 600 lines of transcribed markup. Reproducing the
entire page body here would duplicate the snapshot the task instructs the implementer to port from,
and the two would drift. The acceptance test in Task 8 is what makes this safe: a section rendered
incompletely fails on phrases or packages.

**Type consistency.** `readCampaign(dir, override)`, `derive(data)`, `loadCampaign(dir) → {data, derived}`,
`renderRoadmap/renderWorklog/renderBoard({data, derived})`, `renderGraph({data, derived})`,
`checkHtml(html, opts) → string[]`, `esc/rich/attr(s) → string`. `derived.threads` is a `Map` in every
consumer. `state` is `'not-started' | 'live' | 'dry'` in derive, the strip's `data-state`, and the
graph's. `pips` is a string everywhere. Totals wording is one literal shared by Tasks 9 and 11 tests.
