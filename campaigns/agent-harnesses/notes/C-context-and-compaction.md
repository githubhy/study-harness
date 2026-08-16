# C · Context & compaction

Thread C asked: *what should be dropped when the context fills, and is the decision positional, semantic,
or size-based?*

This is the thread my toy's worst shortcut raised — `.slice(0, 4000)` on every tool result. Note 01
recorded it as a shortcut; note 02 measured what it cost. The card is marked **needs a capture**, and part
of it still does: this note answers the policy question from source and states plainly what it cannot
answer. Read against source at `47f9438`.

## The answer is all three, layered

Two mechanisms, deliberately separate.

### 1 · Tool-result pruning — size-based, structural, model-free

`compaction-tool-result-pruner` (331 lines) is *"replay-safe, model-free tool-result pruning."* Its entire
config is three numbers:

```
thresholdChars: 8192      // only results larger than this are touched
headChars:      4096      // kept verbatim from the start
tailChars:      1024      // kept verbatim from the end
PRUNE_MARKER = '\n\n[... tool result middle pruned ...]\n\n'
```

```diagram
kind: chain
title: What happens to an oversized tool result
caption: Size-based, no model call, and reversible. The middle is replaced by a marker the model can read; the node is shadowed rather than deleted, so the full text stays in the log and replay recovers it. Defaults from compaction-tool-result-pruner/src/config.ts.
node: tool result | any size
node: over 8192? | size-based test
node: prune middle | head 4096 + tail 1024
node: shadow the node | full text retained
node: what the model reads | marker in place
edge: on append
edge: if larger
edge: replacement cites it
edge: projection
mark: 2 | no LLM call
mark: 4 | replay recovers the original
```

**Three differences from what my toy did**, each of which matters:

- **Head *and* tail, not head only.** My toy kept the first 4,000 bytes. A tool result's *end* is
  frequently where the answer is — the error line, the total, the last lines of output. Head-only
  truncation systematically destroys the part most likely to be load-bearing, which is exactly the failure
  note 02 measured: results clipped mid-content, the model narrowing its query to compensate, and the run
  ending at the step cap with no answer.
- **A threshold.** Results under 8,192 characters are untouched. My toy clipped at 4,000 unconditionally,
  so it damaged small results that cost nothing to keep whole — 5 of 9 in the measured run.
- **The model is told.** `PRUNE_MARKER` is visible in the content. My toy truncated silently, so the model
  could not distinguish "the file ends here" from "the rest was taken away."

A validation rule guards the obvious misconfiguration: `headChars + tailChars` must be at most
`thresholdChars`, or pruning would make a result *larger*.

### 2 · Range compaction — positional selection, semantic replacement

`compaction-basic` (1,621 lines) is the general engine. Its config carries a `thresholdRatio` (how full the
context must be before it fires) and a `retainRatio` (how much recent history is kept), and it works by
`selectCompactableRange` followed by `summarizeWithLlm` — a **contiguous range** of history replaced by
**one summary node**, with its own summarization provider and model.

So the decision is positional in *what* it selects — a range, with recent history retained by ratio — and
semantic in *what it substitutes*, since a summary is an LLM's reading of that range.

The layering is the design: **cheap structural pruning first, expensive semantic summarization only when
that is not enough.** Pruning costs nothing and is reversible; summarizing costs a model call and is not.

## Nothing is deleted

The property that makes this coherent with the rest of the campaign: a pruned result is **shadowed**, not
removed.

> ...cites the shadowed node so **replay can recover the replacement input**, and is immediately preceded
> by a `compaction/prune` shadow-price event pricing the shadowed node through the injected token meter, so
> pure consumers can [account for it].

The full text stays in the durable log. What changes is the projection the model reads. And the token meter
is told what the shadowed node *would* have cost, so Thread J's accounting stays honest about work that was
done but is no longer being sent.

This is Thread E's architecture doing exactly what it was built for. Compaction is not an edit of history —
it is a different fold over the same log. A harness whose truth was the in-memory message array would have
had to destroy something here.

## What this note cannot answer

Two things, and I would rather leave them open than guess.

- **The growth curve under real pressure.** Note 02 measured a 3-step run: dsh started 31× larger than my
  toy and grew ×1.18 where the toy grew ×4.3, and I wrote then that the open question is what happens on a
  thirty-step task. Nothing above answers that — `thresholdRatio` says compaction fires as a fraction of
  the window, but which fraction, how often it fires in practice, and what the curve looks like across it
  are empirical. **Needs a capture of a long-running task.**
- **Code Mode's effect on the curve** — Thread D's question. Code Mode puts only the outer `run_code`
  result in model history while sub-dispatches are logged separately, so a run that would have been twelve
  tool results might be one. That should flatten the curve substantially, and it is a *prediction*, not a
  finding. **Needs a capture in each presentation mode to compare.**

Both are one experiment: the canonical task made long enough to trigger compaction, run twice, once per
presentation mode. That is the next capture this campaign should take.

## The experiment, run

Two legs, same task, same profile, one variable: `DSH_TOOLS_MODE`. The headless profile already wires
presentation mode to that environment variable and mounts `code-runtime` by default, so nothing else
differed. The task forced repeated large file reads — *"read each of the six .ts files in
`packages/core/agent-loop/src` one at a time using the read tool"* — and both legs returned the same
correct answer.

| | native | Code Mode |
|---|---|---|
| tools offered | 25 | **1** |
| loop steps | 8 | 9 |
| system prompt | 4,063 B | **34,998 B** |
| tool schemas, per request | 26,983 B | 908 B |
| **floor** (prompt + schemas) | 31,046 B | 35,906 B |
| first request | 56,767 B | 61,627 B |
| last request | 148,660 B | **129,893 B** |
| growth | ×2.62 | ×2.11 |
| **total sent across the run** | **843,262 B** | **816,919 B** |

```chart
kind: series
title: What each request actually cost, step by step
unit: bytes
caption: Full request bodies, not just messages — the tool schemas are re-sent every step and belong in the total. Code Mode starts higher and ends lower, and the two runs cost within 3% of each other overall.
series: native | @long-native.requestBytes
series: code mode | @long-code.requestBytes
```

**Code Mode did not flatten the curve. It moved the cost.** The 25 tool schemas left the `tools` array
(26,983 → 908 bytes) and reappeared in the system prompt (4,063 → 34,998 bytes). Both fields are re-sent
on every request, so nothing was saved: across the whole run native sent 843 KB and Code Mode 817 KB, a
**3% difference** — and Code Mode took one *more* step to get there.

### Why the prediction failed, and what it was actually wrong about

Thread D predicted: *"a run that would have been twelve tool results might be one. That should flatten the
curve substantially."* Two separate errors.

The first is mine to own as a **confound**: my task said *"read each file individually with the read tool.
Do not use bash, grep, or glob"* — phrasing written for native mode. In Code Mode the model complied
literally, calling `run_code` once per file (8 calls). So the *batching* half of the prediction was never
tested. Whether Code Mode wins on a task that permits batching remains open, and it is now a
well-specified question rather than an assumption.

The second is a genuine correction. I assumed offering one schema instead of twenty-five makes the floor
cheaper. It does not, because **the schemas do not disappear — they are rendered into the prompt as an SDK
surface.** Code Mode is a change of *encoding*, not a reduction. Its floor here was 16% larger, not
smaller.

The honest summary: **Code Mode is a capability, not a behaviour.** Offering one tool does not make a
model batch its work, and the encoding change alone is close to cost-neutral.

## The pruner never fired, and that corrects this note

The final requests carried tool results of **33,189** and **30,348** bytes — far above the pruner's
8,192-character threshold. Nothing was pruned, and `tool-result-pruner` *is* mounted in the headless
profile. Reading the caller explains it:

```
// compaction-basic/src/index.ts
if (trigger === 'context-overflow') {
  if (prune !== undefined) { prune.pruneSession(agent.session); measurement = meter.measure(...) }
  const range = selectCompactableRange(...)
  return this.compactRegion(...)
}
```

**Pruning is the first phase of compaction, not a standing policy.** It runs when compaction runs —
`context-overflow`, or `pressure` against the routed model's resolved capacity — and prunes oversized
results as the cheap move before summarising. The section above describes the ordering correctly
(*"cheap structural pruning first, expensive semantic summarization only when that is not enough"*) but
implied the threshold was a continuous trigger. It is not: a 33 KB tool result sits in context untouched
for as long as the window has room, and both mechanisms are gated behind the same event.

Which also means this run never reached compaction at all. 129 KB of context did not cross
`thresholdRatio` for this model, so **the growth curve above is the uncompacted curve** — the first of C's
two open questions is answered only up to the point where compaction would begin.

## The instrument was wrong, and note 02 with it

The reason this took two attempts to read correctly: `measure.mjs` computed `contextBytes` from
`body.messages` alone. The tool schemas — 26,983 bytes, re-sent on every one of eight requests, **26% of
everything native put on the wire** — were never counted.

That silently understated every request figure this campaign has quoted. Note 02's *"first request
9,382 B"* was really **36,545 B**; its *"31× larger than the toy"* was **43.6×**; its *"the task is 1.2%
of the request"* was **0.3%**. The qualitative reading held — it got *more* extreme, not less — but the
numbers were wrong for a month of notes. `measure.mjs` now records `toolSchemaBytes` and `requestBytes`
alongside `contextBytes`, and note 02 carries a dated correction rather than edited figures.

## Questions this opens

- `retainRatio` keeps recent history and summarises the rest, so the system prompt and the injected
  reminders are presumably outside the compactable range entirely. What is structurally exempt from
  compaction? → **A**

## Provenance

Source read at `47f9438`. Pruner defaults quoted from `compaction-tool-result-pruner/src/config.ts`;
`compaction-basic`'s config fields from its schema. **No capture was taken for this note** — the two
questions above are marked open rather than answered.
