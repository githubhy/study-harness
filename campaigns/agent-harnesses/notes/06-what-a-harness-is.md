# 06 · What a harness is

The campaign's synthesis. Fifteen threads, two specimens, four experiments, and one toy written to have
something to be wrong about. This is what it added up to.

Everything here is argued in a specific note; this is the front door, not the evidence.

## The thesis

**An agent harness is an event-sourced system whose log has to double as a provider-valid transcript.**

That single constraint — the source of truth must also be legal to send to a model — is what separates
this design from ordinary event sourcing, and almost every other finding is downstream of it.

Thread I found the motive stated outright, in the docstring of the crash-repair module: the synthetic tool,
step and turn boundaries exist *"to resume with a provider-valid transcript."* A transcript containing a
tool call with no matching result is not untidy — it is rejected on the wire. So the balance property is
enforced three times over by parties that do not trust each other: the loop's `finally` blocks produce it,
the token meter throws when it is violated, and repair manufactures it after a crash.

Once you see that, the rest stops looking like a list of features:

| Finding | Why, given the log is the authority |
|---|---|
| Every boundary wrapped in `finally` (B) | An unbalanced log is not a foldable one |
| Token meter throws on a `step/end` with no `step/start` (J) | It is a projection; malformed input is a bug, not data |
| Delegated policy *appended as events* rather than passed (F) | So the child's policy is a fold over the child's own log |
| An approval that cannot be appended is not returned (K) | A decision outside the log does not exist to any projection |
| Five of nine session-header fields are lineage (I) | A fold has to start somewhere, and at resume there is no parent to ask |
| Runtime context emitted only on change (B) | Identical snapshots are not events |
| Compaction shadows rather than deletes (C) | It is a different fold over the same log, not an edit of history |

## What terminates a loop

The question the study started from, and the answer is: **nothing internal**.

There is no step cap anywhere in the specimen. Rather than infer that from a failed search, Thread J swept
every ceiling the repo defines and classified each by what it governs — `timeoutMs` bounds one tool call,
`maxTokens` one model call, `maxParallelToolCalls` one step, `maxDepth` one delegation chain, the
`DEFAULT_MAX_*_BYTES` family one payload apiece. **Not one bounds a run.** No turn cap, no session token
budget, no wall-clock deadline, no cost ceiling.

Termination is semantic instead: a closed set of six recorded reasons, one of which (`interrupted`) is
never emitted at runtime at all — a persistence backend writes it on reload to close a turn orphaned by a
crash.

And it transfers. Phase 4 measured 4,019 transcripts of the *other* harness: median 8 assistant turns, p90
47, **max 11,118**, no clustering at any round number. Three orders of magnitude of spread and no ceiling.

The uncomfortable corollary, also Thread J's: a `Stop` hook that denies does not stop anything — it
*forces continuation*, unboundedly, and both hook bridges carry a `TODO(stop-loop-guard)` while hardcoding
`stop_hook_active` to `false`, which is the signal a hook would self-limit with. With no cumulative bound
anywhere behind it, that is not one hole in a fence. It is the fence.

## The design law, five times

The most transferable thing the campaign found, and it is not about harnesses at all.

- `concludesTurn` is **data on a result**, not a callback — *"data decides, so listener order cannot change
  the outcome"* (B)
- A `ToolGuard` returns a reason or nothing, with **no allow value** — *"listener ordering cannot turn a
  denial back into permission"* (D)
- Delegation depth is **monotone**; runtime options may deepen it and can never lower it, because a resumed
  child counting from zero could delegate as if top-level (F)
- `applyChildComposition` **takes the parent as a parameter**, so composing a child without joining its
  parent — which would silently give it an empty tool registry — is *"unrepresentable at the call sites"*
  (F)
- Workflow lifecycle events are observe-only and **"never expose run control"** (O)

Five subsystems, one move: **where a mistake would be silent, make it impossible to express.** Not
documentation, not an ordering rule, not a lint — a type or a signature with no room for the wrong answer.

The same instinct shows up as loud failure everywhere else: `restrict({})` throws, an unknown tool name in
a restriction throws, a duplicate registration throws, a depth cap against a provider that cannot enforce
it fails at mount. Exactly one silent widening was found in the whole specimen — an unsupported MCP output
schema swallowed by a `try/catch` (Phase 3).

## Five stages, and what each one actually decides

```diagram
kind: chain
title: The loop, and the decision that lives at each stage
caption: The category-level answer. Every harness has these five stages; what distinguishes one is the decision it makes at each, and how much of that decision it lets someone else make.
node: assemble | prompt is a registry
node: call model | provider is a plugin
node: parse calls | on the assistant message
node: execute | a three-stage gate
node: append | a value, then a projection
edge: sections by order
edge: interceptable
edge: tool-call blocks
edge: canonical value
back: nothing counts these — termination is semantic, and every bound is per-unit
mark: 1 | never enters history
mark: 4 | default is allow
```

**Assemble.** The system prompt is a registry of ordered named sections, and every tool ships its own — so
the prompt is a function of what is mounted, and a central capability list that drifts out of step with the
capabilities is a bug that cannot be written (A). It is rebuilt every step and never enters history, which
is why compaction cannot reach it without any rule saying so.

**Call.** Three separable seams, not one adapter interface: a registry, a waterfall so a plugin can supply
the model per request, and retry as its own plugin on the loop's error hook — absent by default (L).

**Execute.** Permission is three mechanisms with different powers: `restrict` removes a tool from view
entirely, the `tools/pre-execute` waterfall is negotiable and **defaults to allow**, and guards are
deny-only (D). Confinement underneath is real OS-level wrapping, probed by running rather than detected,
and missing confinement is a refusal rather than a downgrade (G).

**Append.** A tool never produces model-facing text. `execute` returns a canonical JSON value; a pure
`render` projects it (D, Phase 3). That one split is why results replay identically, why Code Mode can hand
a program the value while the model gets the sentence, and why an imported MCP tool — which has no domain
value to declare — ends up with *"an MCP response"* as its canonical value.

## What composition buys

Several properties in this system exist in no single package. The sharpest:

**The model can extend the harness only where a human is present to approve it.** `cordis_define` is free,
`cordis_run` raises an approval request (E); approval fails closed with no answerer (K); headless mounts no
answerer (D); and a delegated child's approval policy is pinned to `never` (F). Four packages that do not
reference each other. Phase 4's profile diff then showed it is stronger than that: the approval
orchestrator and UI are **not mounted in headless at all** (M), so the composition enforces it structurally
and the runtime fail-closed path is the second line of defence.

**You cannot escape a sandbox by delegating.** The parent's mode is captured synchronously at delegation,
the child inherits it, and the child's escalation resolves `rejected` before reaching anyone (F + G).

## What I got wrong

Seven errors, and the pattern in them is the campaign's most useful methodological result.

1. **I invented a `tui` profile.** Note 00 asserted one from "what the help text said". No profile, no
   package, no directory — and the help never claimed it. A terminal UI is such a normal thing for a
   harness to have that the detail completed itself.
2. **I got dsh's schema dialect wrong twice**, and had already written a paragraph asserting "two different
   schema dialects" after the first rejection (Phase 3).
3. **My instrument never counted tool schemas.** `contextBytes` read `body.messages` alone, so 26,983 bytes
   re-sent on every request — 26% of everything on the wire — were invisible. Note 02's "first request
   9,382 B" was really 36,545 B; its "31× larger" was 43.6×; its "the task is 1.2% of the request" was
   0.3%.
4. **My leak check scanned nothing.** It took files as arguments, so the bare command printed
   `clean: 0 captures` and exited 0. I ran it that way all campaign and quoted the result as evidence — in
   the one check whose false pass is unrecoverable.
5. **I designed an experiment that could not test its own hypothesis**, instructing per-file reads and then
   concluding Code Mode does not batch (C).
6. **Thread H over-generalised** that the delegation boundary is the observability boundary. It is the
   *process* boundary; Claude Code's sub-agents are legible for the same reason dsh's in-process children
   are.
7. **Both of my scoreable recall predictions about Claude Code were wrong** — while both inference
   predictions held (Phase 4).

Every single one was caught by **running something**, never by re-reading. The `tui` claim died to
`dsh --profile tui`. The schema drafts died to `defineTool`. The instrument defects surfaced only when a
real capture existed to measure. The leak check's vacuity surfaced only when it finally had files to scan.

That is the method result: **for a system like this, execution is a better epistemic instrument than
reading, and the gap is not close.** Reading produces plausible wrong answers with no signal attached.
Running produces a rejection with the violation named.

The second-order lesson is #7. My model of a harness I had *read the source of* outperformed my model of
one I *am*. Being a thing is not the same as knowing how it works.

## What to ask the next specimen

Not "does it have tools, hooks, sub-agents" — everything does. These four questions distinguish designs:

1. **What is the authority, and is everything else a fold over it?** A harness whose truth is an in-memory
   message array with a log written alongside for debugging will differ at every row of the table at the
   top of this note, and those differences will look like unrelated bugs rather than one decision.
2. **What is bounded — per unit of work, or cumulatively?** Every specimen will have limits. Ask which
   ones bound a *run*.
3. **Where does the extension model make a wrong direction unrepresentable**, and where does it merely
   document an ordering rule?
4. **Does a tool declare what it returns, or write what the model reads?** That one answer predicts whether
   results replay, whether a program can call the same tool, and how much survives translation from a
   foreign protocol.

## Provenance

Specimen `deepseek-ai/deepseek-harness` at `47f9438`, transfer specimen Claude Code via 4,019 local
transcripts (structure, counts and tool names only). Every claim here is argued in a linked note; the
worklog carries all 45 findings with their dates and the questions each opened. Four captures were taken
through a redacting proxy and are gitignored; the derived numbers are committed in `measurements.json` and
re-checked against the captures on every build.
