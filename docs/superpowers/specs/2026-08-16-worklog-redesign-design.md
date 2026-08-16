# Worklog redesign — design

**Status:** approved in brainstorm, 2026-08-16.
**Supersedes:** the worklog's single-column layout of masthead → strip → graph → notes → frontier → trail.

## Why

Almost every instrument on the worklog is built for a campaign *in flight* — pips counting down a
surprise budget, dry detection, a frontier, a "live" list, "not started" totals. This campaign is
finished: 15 threads touched, 0 dry, 0 not started, all 21 questions answered. So the page's most
prominent objects currently report the absence of something.

Two further problems, found by reading the rendered page rather than the source:

- **The spine was inherited, not chosen.** Findings group by thread because the coverage strip does.
  A thread letter means nothing to a first-time reader; `Assemble / Call / Execute / Control /
  Around` does.
- **Three objects say overlapping things.** The coverage strip, the thread graph and the notes index
  are three separate presentations of the same fifteen threads.

## Decisions

| Decision | Choice |
|---|---|
| State the page is designed around | One layout serving both. Findings lead; work-in-progress instruments stay but subordinate, and render **empty rather than absent** when there is nothing to report. |
| Spine | Loop step — five sections, threads inside. |
| Nesting | Hybrid: a thread with more than one finding keeps a block; a thread with exactly one renders as a single labelled finding. |
| Layout | Two columns, sticky rail. |
| Rail contents | One vertical spine — the coverage strip, the thread graph and the contents collapsed into a single object. |
| Findings | Full prose, each carrying a mark for whether it was logged surprising. |
| Narrow widths | Rail unsticks. The existing pip strip goes above the findings; the existing horizontal arc diagram goes to the foot. |
| Code shape | A shared layout core computing geometry as data, with two thin renderers. |

### The hybrid rule is principled, not a threshold

It lands on exactly **L and N** — and those are precisely the two threads with **zero edges** in the
thread graph. The two shapes track a real distinction in the data: a thread that produced one finding
and neither asked nor was asked anything. It also dissolves the Call-section problem, since Call holds
only L and so becomes one heading and one finding rather than a heading wrapping a heading.

**Anchor invariant:** every thread owns exactly one element carrying `id="t{letter}"` — a block for
the thirteen, the finding itself for L and N. The roadmap links to these, and so do all 36 links in
the thread graph, so this is load-bearing and is asserted by test.

## Constraints discovered

- **No JavaScript.** `checkHtml`'s `EXTERNAL` rule rejects `<script` anywhere on the page. A sticky
  rail's usual scroll-spy "you are here" is therefore unavailable. `:target` styling (which fires when
  a reader *clicks* a rail link) is used instead. Scroll-driven CSS animations would work in Chrome
  and Safari but not Firefox, so they are out.
- **Nothing may collapse.** `checkHtml` rejects `<details>`, so page length cannot be hidden behind
  an expander. Whatever a finding shows, it shows.
- **The rail is narrow.** The horizontal figure encodes direction by side — forward arches above,
  back arches below. The vertical spine cannot: bowing arcs both ways needs margin on both sides that
  a rail does not have. In the spine all arcs bow one way and direction is carried by the arrowhead
  alone. This is a deliberate loss; the horizontal figure, where side-means-direction survives intact,
  remains available at the foot on narrow widths.

## Architecture

### `tools/campaign/graph-layout.mjs` — new, pure, no markup

```js
layout(derived, { orientation, ...metrics }) → { viewBox, axis, dividers, groups, nodes, arcs }
```

The core computes **concrete coordinates**, not abstract indices. Returning "thread D is at position
5" and letting each renderer work out pixels would leave the geometry in two places and the invariants
still untestable.

```js
nodes: [{ letter, name, state, pips, findings, x, y, r, href }]
arcs:  [{ from, to, dir, span, open, href, label, x1, y1, x2, y2, c1x, c1y, c2x, c2y }]
groups:[{ id, label, x, y, anchor, from, to }]
```

This shape is what makes the arc form's own claim testable: **no arc passes through a node** becomes
sampling each cubic and asserting every sample is further than `r` from every node centre. Today that
is not tested at all, because it cannot be expressed as a regex over `d=`.

### `tools/campaign/graph.mjs` — rewritten to consume the core

Keeps its horizontal figure, its side-encodes-direction, its clickable arcs and hit paths. Computes
no coordinates.

### `tools/campaign/spine.mjs` — new

The vertical rail figure. Draws the same threads down the page in band order under the five loop-step
labels, each with pips and a link to its block, with question-arcs bowing to one side. Is
simultaneously the coverage strip, the thread graph and the table of contents.

### The page

Rail (sticky, wide widths only):

1. **Reports** — the seven numbered notes in reading order, `00` → `06`.
2. **The spine** — 15 threads, grouped by loop step.
3. **Open questions** — the frontier, rendering "No open questions" quietly when empty.

Main column:

1. Masthead.
2. Five loop-step sections. Each carries the step's `label`, its `step` string and its `question`
   gloss — all already in `campaign.json`, no new data.
3. Inside each: thread blocks (>1 finding) or single labelled findings (L, N).
4. Each finding: full prose, its date, its opened/answered marks, its note link, and a **surprise
   mark** reusing the campaign's own pip vocabulary — `●` surprising, `○` not.

**The standalone "The notes" section is removed.** Its content is now the rail's Reports list plus
each thread block's own note link; keeping both would be two homes for one index. All 22 notes remain
reachable, and the existing test asserting exactly that stays.

## Model changes

- `derived.sections` — the five loop steps, each with its threads already sorted into "block" or
  "single" shape, so the renderer makes no structural decisions.
- `derived.answeredBy`, `derived.noteFor`, `derived.noteIndex`, `derived.trailByThread` already exist.
  `trailByThread` is superseded by `sections` and is removed if nothing else consumes it.

## Testing

The point of the core is that correctness is asserted on numbers, once, for both orientations:

- Every node inside the viewBox; no two nodes overlap.
- Every arc endpoint on its node's rim, not its centre.
- **No arc passes through a node.**
- Node order matches `derived.bands` exactly.
- Every arc's link target resolves against the rendered page.
- Every thread owns exactly one `id="t{letter}"`.

Plus **property tests over synthetic campaigns** — 1 thread, 40 threads, a band with one member, a
thread with no edges, an empty log — asserting the invariants hold across all of them. Today those
cases are found by rendering a PNG and squinting, which is discovery by luck.

**Contrast is automatable and will be asserted:** every colour the figures use is a theme token, so
its ratio against both grounds can be computed without rendering.

### What still needs eyes

This does not retire the render-and-look step. The two real bugs in the previous redesign — five
baselines reading as one continuous line, and arrowheads washing out on the dark ground — were
perceptual, and no layout assertion would have caught either. The core shrinks what eyes are
responsible for from "is this correct?" to "does this read well?"
