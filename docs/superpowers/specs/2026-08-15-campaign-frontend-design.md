# Campaign Frontend Design

**Date:** 2026-08-15
**Scope:** repo-wide. Applies to the campaign board and to every campaign's roadmap and worklog.
**Status:** approved in brainstorm, not yet implemented.

Lives in `docs/superpowers/specs/` rather than inside a campaign because it governs all campaigns.
Campaign-scoped documents live at `campaigns/<name>/`; see `CONTEXT-MAP.md`.

---

## Problem

`roadmap.html` currently makes claims that will become false. Six cards carry a `not started` chip
and the campaign board says `phase 0 · not started`. The moment Phase 0 runs, those are stale, and
nothing in the repo forces them to be corrected.

Separately, the roadmap has no representation of two things the study actually runs on:

- **The thread graph.** Threads cross-reference each other constantly — J asks whether `token-meter`
  budgets or accounts, which is a question for C; O asks whether the todo list is context or state,
  also C; E's native-boundary answer sets up H's standard-boundary one; D gates Phase 3. The plan
  assumes depth-first work that follows these references, and none of them are drawn anywhere.
- **The surprise budget.** The stopping rule is two consecutive unsurprising findings, and it is
  per-thread. Nothing displays it, so a thread going dry is only visible in prose notes.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| State model | Living record, agent-updated | Keeps no-JS and offline-safe; state lands in git where it is reviewable |
| Audience | The author, in public | Optimise for recall and next-action speed; no reader-facing framing |
| Page split | Stable roadmap + living worklog | A page that claims nothing cannot go stale |
| Next-pick drivers | Cross-references and surprise budget | Both were selected; the design must serve both |
| Graph rendering | Text relations, not a drawn node-link diagram | Hand-maintainable; 15 nodes do not repay layout work |
| Strip grouping | Loop bands, letters sorted by state within | Keeps coverage legible and stable while surfacing live work |

Rejected: making lineage the spine of the thread menu (the lineage does not exist yet, so the page
would be worse today and better later); enriching the existing cards in place (re-creates the two
competing organizing systems that motivated the last redesign); generating the pages from source
(adds a toolchain to a repo that has none).

---

## The four surfaces

State is written in exactly one place and copied outward at most one hop, in the same commit.

| Page | Job | Claims state? | Changes when |
|---|---|---|---|
| `campaigns/index.html` | Which campaign is hot, where to resume | Campaign-level, one line each | A campaign starts, stalls, or ends |
| `campaigns/<n>/roadmap.html` | What the campaign is and what it asks | **Never** | The plan changes |
| `campaigns/<n>/worklog.html` | What has actually happened | All of it | Every session that produces a finding |
| `campaigns/<n>/plan.md` | The executable steps | Checkboxes only | Task completion |

---

## `worklog.html`

New page, one per campaign. Three regions, in this order.

### 1. Coverage strip

Sticky (`position: sticky; top: 0`), so the surprise budget stays visible while the trail scrolls.
Pure CSS — no JavaScript.

Five rows, one per loop step, in the same order as the roadmap's §4 bands: assemble, call, execute,
control, around. A letter occupies the same band on both pages.

Within a band, letters sort: **live first** (most recently touched first), then **not started**, then
**dry** (struck through, pushed right). Live work drifts left as it progresses.

Thread states — four, not three:

| State | Render | Meaning |
|---|---|---|
| Not started | dashed border, letter only | No session has opened it |
| Live `○○` | solid border | Opened; zero *consecutive* unsurprising findings |
| Live `●○` | solid border | One consecutive unsurprising finding |
| Dry `●●` | solid, struck through | Two consecutive — abandoned, issue filed |

The counter is consecutive, so a surprising finding resets a `●○` back to `○○`. This mirrors the
standing order in the roadmap's §7; the worklog displays it, the standing order defines it.

Strip header carries the totals: `N touched · N dry · N not started`.

Every letter is an anchor to its trail entries.

### 2. Frontier

The open questions, which is the queue. One line each:

```
▸ Does token-meter budget or account?              from J → ask C
```

Three fields: the question, the thread that raised it, the thread that answers it. This is the graph,
rendered as text. A question leaves the frontier when the answering thread produces a finding that
resolves it; the answer then lives in the trail.

Header carries a count: `N live`.

### 3. Trail

Append-only, newest first. One entry per finding:

```
J · observability          ●○      2026-08-22
Hooks CAN block — preventedContinuation on system records.
→ opened: does token-meter budget or account? (C) · notes/J-observability.md
```

Fields: thread letter and name, pip state at the time, date, the finding in one sentence, what it
opened (zero or more, each naming the target thread), and the path to the note.

A dry entry additionally records the abandonment and the issue number, and dims:

```
D · tools & permission     ●●  dry  2026-08-20
Approval is path-scoped; default deny outside the workspace.
→ abandoned on surprise budget · filed #7 · unblocks Phase 3
```

### Anchors

`#tA` through `#tO`, matching `roadmap.html`. Each worklog entry links back to `roadmap.html#tX`;
each roadmap thread card links forward to `worklog.html#tX`.

### Visual system

Reuse `roadmap.html`'s tokens verbatim — same palette, same `--specimen` / `--control` / `--go` /
`--gate` semantics, same serif body with mono metadata. The two pages must read as one system.

Non-negotiable properties, carried from the roadmap:

- `<meta charset="utf-8">` as the first line — without it, `file://` renders mojibake.
- Three-state theming: bare `:root` light palette, `@media (prefers-color-scheme: dark)` guarded by
  `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`. No colour defined only inside a
  media or `[data-theme]` block.
- No external requests. No `<script>`, no `<link>`, no webfonts.
- No `<details>`. Nothing collapses.
- `body` sets an explicit background from a token.

---

## Changes to existing pages

### `campaigns/<n>/roadmap.html`

1. Remove all **six** `c-state` chips from §3's board cards — one per card across the four lanes
   (0.1, 0.2, Phase 1, Task 2.0, Phase 3, Phase 4) — and the `.c-state` rule from the stylesheet.
   Keep every `c-blocks` line: blocking is structural, not temporal.
2. Add a `→ worklog` link to each §4 thread card, anchored to `worklog.html#tX`.
3. Add the worklog to the footer.
4. Add the note/trail parity check to §8, next to the package census.

§1, §2, §5, §6, and §7 are unchanged.

### `campaigns/index.html`

Replace the `phase 0 · not started` chip with a **resume line**: the newest finding in one clause,
then the same three totals the worklog strip carries — `N touched · N dry · N not started`. Add a
worklog link beside the roadmap link on the campaign card.

The totals use identical wording in both places deliberately: they are the same numbers copied one
hop, and differing labels would make a copy error invisible.

---

## The update protocol

A finding lands in one commit touching three files, or it does not land:

1. `campaigns/<n>/notes/<LETTER>-<slug>.md` — the prose. Source of truth.
2. `campaigns/<n>/worklog.html` — one trail entry; the strip pip for that thread; the frontier delta
   (questions opened added, questions answered removed).
3. `campaigns/index.html` — the resume line, if this was the campaign's newest finding.

When pips reach `●●`, the same commit strikes the letter in the strip, files a `needs-triage` issue
per `docs/agents/triage-labels.md`, and records the issue number in the trail entry.

---

## Verification

Every note cited by the worklog must exist, and every note must have a trail entry:

```bash
cd campaigns/agent-harnesses
rg -o 'notes/[A-O]-[a-z0-9-]+\.md' worklog.html | sort -u > /tmp/cited
ls notes/[A-O]-*.md 2>/dev/null | sort > /tmp/actual
comm -3 /tmp/cited /tmp/actual        # must print nothing
```

The pattern is restricted to `[A-O]` on purpose. The campaign also produces notes that are **not**
thread notes and must not be compared — `00-orientation.md`, `01-what-my-harness-lacks.md`,
`02-baseline-behavior.md`, and `X-transfer-test.md`. A looser glob reports every one of them as an
uncited note and the check fails permanently from Phase 0 onward.

Plus the checks already applied to the roadmap, extended to the worklog: zero external references,
zero `<details>`, balanced tags, every `var(--token)` defined in the bare `:root`, every `href="#..."`
resolving to an `id`, and `charset` present within the first 1024 bytes.

---

## Out of scope

- **A reader-facing findings view.** The audience decision was "you, in public"; a public write-up is
  a separate deliverable if it ever happens.
- **JavaScript and `localStorage`.** State belongs in git.
- **Generating the pages from `plan.md` or `notes/`.** Reconsider only if the parity check starts
  failing routinely.
- **A drawn node-link graph.** Text relations carry the same information at 15 nodes.
- **Effort estimates and thread sizing.** "Cheapest unblocked" was not selected as a next-pick driver.

## Deferred

- **Board layout beyond ~3 campaigns.** One campaign exists. Revisit when a third is created.
- **A `notes/` index page.** Not needed while the trail links every note.
- **`campaigns/agent-harnesses/roadmap-samples/`.** Three superseded layout candidates carrying stale
  paths; the only stale references left in the repo. Delete when confirmed.
