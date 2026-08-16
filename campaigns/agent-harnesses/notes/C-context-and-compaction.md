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

> **Attempted 2026-08-16; blocked on account credit.** The DeepSeek key returns HTTP **402 Insufficient
> Balance**, so no long run could be captured. Three things were established anyway, and the experiment is
> now a single command when credit exists:
>
> - **The A/B is one variable.** The headless profile already wires presentation mode to an environment
>   variable — `config: { mode: !!js process.env.DSH_TOOLS_MODE }` on the `tools` row — and mounts
>   `code-runtime` by default. So `DSH_TOOLS_MODE=code` is the whole difference between the two legs; no
>   patch file, no second profile.
> - **The instrument still works.** The proxy round-tripped a real request to `api.deepseek.com` and wrote
>   `authorization: <redacted>` to disk; leak-check clean. Headless offered **25 tools** on
>   `deepseek-v4-flash`, matching note 02.
> - **The detached title call fired anyway**, independently of the failing main call — Thread B's
>   `void this.track(run)` finding, observed rather than read.
>
> It also exposed a real defect in this campaign's own tooling, now fixed: the build re-derives
> `measurements.json` from whatever captures are on disk, and a failed run is still a capture. The 402 run
> made `--check` report drift; had it been a plain build, every number in every note would have been
> silently rewritten from a run that never got an answer. `measureCapture` now returns `null` for a
> capture whose every response failed, while still measuring a run where only some calls failed.

## Questions this opens

- `retainRatio` keeps recent history and summarises the rest, so the system prompt and the injected
  reminders are presumably outside the compactable range entirely. What is structurally exempt from
  compaction? → **A**

## Provenance

Source read at `47f9438`. Pruner defaults quoted from `compaction-tool-result-pruner/src/config.ts`;
`compaction-basic`'s config fields from its schema. **No capture was taken for this note** — the two
questions above are marked open rather than answered.
