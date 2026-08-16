# 05 · Transfer test, scored

Phase 4, part two. Predictions were committed in `notes/04-transfer-predictions.md` at `8b7df5d`, before
any transcript was opened; this note is a later commit, which is the only proof of sequence worth having.

Evidence: 4,019 `.jsonl` transcripts across 21 project directories. Per the campaign's standing rule,
**only structure, counts and tool names are cited** — no conversation content appears here or in any
command that produced these numbers.

## The result, up front

| # | Row | Label | Outcome |
|---|---|---|---|
| 1 | Which tools exist and get called | RECALL | **wrong** |
| 2 | How the loop terminates | INFERENCE | **confirmed** |
| 3 | How permissions are gated | RECALL | partial |
| 4 | Whether hooks can block | RECALL | **confirmed, with a mechanism I did not name** |
| 5 | Whether sub-agents fork context | RECALL | **wrong** |
| 6 | Whether the model reasons before acting | INFERENCE | partial, and structurally different |
| 7 | What the system prompt says | RECALL | unscoreable, **as predicted** |
| 8 | What the tool schemas declare | RECALL | unscoreable, **as predicted** |

**Both rows that were fully scoreable and labelled RECALL came out wrong. Both rows labelled INFERENCE
held.** That is the opposite of what the contamination worry predicted, and it is the most interesting
thing Phase 4 produced: the model I built by reading someone else's harness was more reliable than my
model of myself.

## Row by row

**1 · Tools — wrong.** I predicted 15–20 tools and named ten. The corpus contains **30 distinct tool
names**. Six of my ten exist (`Read`, `Write`, `Edit`, `Bash`, `WebFetch`, `WebSearch`); **four do not
appear at all** — `Glob`, `Grep`, `Task`, `TodoWrite`. I missed roughly twenty that do, including `Agent`,
`StructuredOutput`, `ToolSearch`, `Workflow`, `Skill`, `Monitor`, `ScheduleWakeup` and a `Task*` family
that is not `TodoWrite`.

What I got right was shape, not content: TitleCase ✓, and a steep head with a long tail ✓ —

```
Bash 32,318   Read 14,359   Edit 5,468   Write 3,660   Agent 1,861   …   PushNotification 1
```

`Bash` outnumbers `Read` 2.2:1, which I did not predict and would not have guessed.

One uncontaminated finding fell out: the corpus contains `mcp__plugin_cloudflare_cloudflare-api__execute`
and siblings — **the exact `mcp__<server>__<name>` convention Thread H found dsh's `mcp-client` minting.**
Neither harness invented it; it is the ecosystem's, and it transfers unchanged.

**2 · Loop termination — confirmed.** Assistant turns per transcript: median 8, p90 47, p99 153, **max
11,118**. The three most common counts are 7, 5 and 6 — short tasks, not a ceiling — and there is no
clustering at any round number. Three orders of magnitude of spread with no cap is exactly what Thread B
found in dsh's source, observed from the outside in a different harness. **The strongest transfer result
in the campaign**, and the only row where dsh-derived reasoning did work I could not have done from
memory.

**3 · Permissions — partial.** Transcripts carry `permission-mode` records as first-class entries in the
log. That is a genuine convergence with dsh, which appends `sandbox/mode` and `approval/policy` events
(Threads F and G) so that policy is reconstructable from the log alone. Whether grants *persist* — my
actual prediction — is not visible in transcript structure, so that half is unscoreable.

**4 · Hooks can block — confirmed, and it named the mechanism I had been circling.** The corpus contains
`system` records with subtype **`stop_hook_summary`**, carrying fields `hookCount`, `hookErrors`,
`hookInfos`, `stopReason` and — the one that matters — **`preventedContinuation`**.

Thread J found dsh's bridge mapping a `Stop` hook's `deny` to forced continuation, with
`TODO(stop-loop-guard)` and `stop_hook_active` hardcoded to `false`. The transfer specimen records
prevented continuation as a named, logged event. So the capability dsh bridges is real, it is
first-class in the original, and the original keeps a record of when it fires — which is precisely the
accounting dsh's TODO says is missing.

**5 · Sub-agents — wrong, and usefully so.** I predicted a sub-agent's internal steps would be *absent*
from the parent transcript. They are not. Records carry an `isSidechain` flag, and:

```
isSidechain: true   126,557 records      (in 3,875 of 4,019 files)
isSidechain: false   92,701 records
```

**Sub-agent records outnumber main-thread records 1.37 to 1.** Delegation is not a hole in the log; it is
the majority of the log, marked with a boolean.

This corrects something Thread H asserted too broadly. H concluded that "the delegation boundary is also
the observability boundary." The transcripts show that is a property of **process** boundaries, not of
delegation: dsh's *in-process* children keep their session log inside dsh's (Thread F), and Claude Code's
sub-agents are legible for the same reason. Only the out-of-process foreign-runtime case is opaque. The
sharper statement is that **opacity tracks the process boundary, and delegation merely often coincides
with one.**

**6 · Reasoning before acting — partial, and the structure differs.** My falsifier was "tool calls with no
*preceding* assistant text", so that is what I measured, on a 40-file sample:

```
tool-bearing assistant messages          23,909
immediately preceded by a text-only one  12,549   (52.5%)
```

So narration happens about half the time — real, but not the near-universal habit I implied.

The structural finding is better than the score. Across the whole corpus, of 62,453 assistant messages
carrying a tool call, **50 also carry text — 0.08%.** Narration and tool calls occupy *separate messages*
in Claude Code, essentially always.

dsh does the opposite, and the committed measurements prove it without the capture: `messageCounts` is
`[4, 2, 6, 8]`, so each loop step added exactly **two** messages — one assistant, one tool result. Had
narration been its own message, a step would have added three. **dsh puts narration and the tool call in
one assistant message; Claude Code splits them.** Same observable behaviour, different message granularity
— which matters directly to the glossary, below.

**7 and 8 · Unscoreable, as predicted.** No system-prompt records; the `system` record type turns out to
be operational metadata (`away_summary`, `turn_duration`, `stop_hook_summary`), not the prompt. Tool
schemas are not part of the format either.

One correction to my own method: I first checked a single file, found zero occurrences of `input_schema`,
and was about to write "zero in the corpus". Sweeping all 4,019 files found the string in **9** — almost
certainly inside conversation content rather than as structure. The substantive prediction holds (the
format carries no schemas); the absolute claim would have been false. Checked on one file, generalised to
four thousand — the same move that produced the `tui` error in note 00, caught this time before it shipped.

## The glossary sort

The uncontaminated deliverable. Every term in `CONTEXT.md`, against a second harness.

| Term | Verdict |
|---|---|
| **Agent harness** | **Universal.** Both supply a loop, a registry, assembled context, a permission boundary. |
| **Eval harness** | **Universal** as an exclusion; nothing in either specimen blurs it. |
| **Loop** | **Universal.** Assemble, call, parse, execute, append — both. |
| **Step** | **Revise.** Defined as *"the unit a harness's stop conditions count."* Neither specimen counts it: dsh has no step cap (Thread B), Claude Code shows none (row 2). The definition encodes my toy's design, not the category's. |
| **Turn** | **Universal concept, differently materialised.** dsh commits explicit `turn/start`/`turn/end` events with six end reasons; Claude Code has a `turn_duration` metadata record and no boundary pair. The concept transfers; the observability does not. |
| **Tool call** | **Universal**, including the precise clause — *"arriving on the assistant message rather than through any separate channel"* — which holds in both. |
| **Tool result** | **Revise.** *"role `tool`"* is dsh's OpenAI-shaped wire format. Claude Code returns results as `user` records carrying `tool_result` content. The principle — it is just another message competing for context — is universal; the role name is not. |
| **Context window** | **Revise.** *"Re-sent in full on every call"* is contradicted by Thread C: compaction and tool-result pruning mean what is re-sent is a *projection* of history, not history. |

**Missing terms** — concepts both harnesses have that the glossary never named, all discovered through
dsh but confirmed to transfer:

- **Sidechain** — delegated work recorded in the parent's own log. Claude Code names it; dsh has the thing
  (in-process children) without a word for it. The campaign needs this term more than most.
- **Projection / fold** — the relationship between the durable log and what any consumer reads (Thread E).
  Both harnesses have it; only dsh made it explicit enough to notice.
- **Capability seam** — a service definition with pluggable providers, dsh's organising unit.
- **Presentation mode** — Code Mode (Thread D) proves "how many tools the model sees" is a variable, so
  "25 tools offered" was never a fact about a harness.

## What Phase 4 actually established

Not that my predictions were good — half the scoreable ones were wrong. Three things:

1. **Transcripts are a weak instrument for architectural questions.** They show what happened, not what
   the harness is. Rows 7 and 8 were unanswerable in principle, and row 3 half-unanswerable.
2. **Reading someone else's source beat recalling my own behaviour.** Both INFERENCE rows held; both
   scoreable RECALL rows failed. A model built from evidence outperformed a model built from being the
   thing.
3. **The campaign's real transfer evidence was never the transcripts.** It was what Threads J and F
   stumbled on: dsh ships an executable model of Claude Code — a hook bridge and a driver for the real
   Agent SDK. That is source, it is public, and it is checkable. The transcripts' contribution was to
   confirm one thing that source could not: that Claude Code, like dsh, has **no step cap**.

## Provenance

Predictions committed at `8b7df5d` before any transcript was read. All figures from `jq`/`rg` over
`~/.claude/projects`; the 52.5% figure is a 40-file sample of files over 200 KB and is labelled as such.
Structure, counts and tool names only.
