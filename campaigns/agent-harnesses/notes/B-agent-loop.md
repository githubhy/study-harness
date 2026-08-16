# B · The agent loop

Thread B asked: *what legitimately terminates a loop? Your toy just used a hard step cap of ten.*

The answer is that **dsh has no step cap.** Not a different default, not a larger number, not one buried
in config — there is no counter anywhere in the repo that ends a run because it has taken too many steps.
Read against source at `47f9438`, then reconciled line by line against `notes/02-baseline-behavior.md`,
which was written blind.

## The whole configuration surface of the loop is one integer

```
export const DEFAULT_MAX_PARALLEL_TOOL_CALLS = 10     // constants.ts, entire file
```

`packages/core/agent-loop` is 1,643 lines across six files, and its config schema
(`index.ts:246-251`) declares exactly one field: `maxParallelToolCalls`. That is a **concurrency**
limit — how many tool calls may be in flight within one step — not a ceiling on the run. Searching the
repo for any step, turn, or iteration ceiling returns nothing.

So the loop cannot stop because it is bored. It stops for one of six recorded reasons, and that set is
closed (`packages/core/session/src/types.ts:155-174`):

| Reason | Who decides | Notes |
|---|---|---|
| `completed` | the model, or a tool | no tool calls emitted, or a result carried `concludesTurn` |
| `max-tokens` | the provider | at least one step hit the output ceiling |
| `blocked` | a plugin | the `agent/pre-step` waterfall returned `reject` |
| `aborted` | user, parent, hook, or disposal | carries which of the four |
| `error` | anything that threw | always structured — `LlmError` facts, or `UNKNOWN` |
| `interrupted` | **nobody at runtime** | written on reload to close a turn orphaned by a crash |

That last row is the one I would not have invented. The loop never emits `interrupted`; a persistence
backend writes it when it reloads a session whose `turn/start` has no matching `turn/end`. The set of
end reasons is closed partly so that a *crashed process* still produces a well-formed one.

## It is not one loop. It is three.

My toy is a single `while` with a counter. dsh nests three, and only the innermost one talks to a model.

```diagram
kind: chain
title: One step, and the three ways it can end a turn
caption: The step is the only level that calls a model. It returns an end reason or nothing at all — and "nothing at all" is the ordinary case, which is why the absence of a step counter matters. Lines cited from packages/core/agent-loop/src/agent.ts.
node: build request | frozen per step
node: stream chunks | appended as they land
node: assemble message | blocks + usage
node: execute tools | ≤10 in parallel
edge: system + messages
edge: SSE
edge: tool-call blocks
back: no end reason returned — the turn spends another step, and nothing counts them
mark: 3 | ceiling hit
mark: 4 | no calls · concludesTurn
```

- **The driver** — `kick()`, `agent.ts:212` — is `while (await this.turn()) {}`. A turn returning
  `true` means more input arrived while the last turn ran.
- **The turn** — `agent.ts:263` — loops over steps. This is the level my toy's loop corresponds to.
- **The step** — `agent.ts:339` — is *also* a `while (true)`, but it is a **retry** loop, not an agent
  loop. It repeats only when a plugin answers `agent/request-error` with `{kind:'retry'}`.

That third one matters for a claim in note 02. I recorded *"it never retried, and nothing failed."*
Correct — but the reason is stronger than the observation: the default resolver returns `undefined`
(`agent.ts:364`), and anything that is not `retry` rethrows. **Out of the box dsh does not retry at
all.** Retry is a plugin, and the loop's only contribution is a hook to hang one on.

## A turn does not end when the model stops

This is the mechanism I had no concept of. `step()` returning `completed` is *not* sufficient:

```
if (turnEnds && this.inbox.nextStep.length === 0) break     // agent.ts:299
```

Both conditions. The agent has an **inbox** with two queues, `next-turn` and `next-step`, and a tool
result can push into `next-step` while it runs (`tool-calls.ts:156`, `agent.ts:397`). So a tool can
hand the model something new *after* the model has said it is finished, and the turn continues.

```diagram
kind: chain
title: Why "the model stopped calling tools" does not end a turn
caption: Both the step's end reason and an empty next-step queue are required. A tool's additionalContexts and a listener that calls steer() both refill the queue, so either can extend a turn the model considered over.
node: step ends | completed
node: inbox check | next-step queue
node: turn-stopping | listeners may steer
node: turn/end | reason recorded
edge: reason set
edge: drained?
edge: no objection
back: additionalContexts from a tool, or steer() from a listener, refills it — and the turn runs another step
```

The symmetry is deliberate: `concludesTurn` lets a tool **end** a turn the model wanted to continue, and
`additionalContexts` lets a tool **extend** one the model wanted to end. Neither is a special case in
the loop — both are ordinary fields on a tool result, which is why the docstring for the first says
*"data decides, so listener order cannot change the outcome."*

## The invariant I would not have predicted: balance

329 tests cover these 1,643 lines. Reading their names is faster than reading the code, and one word
recurs until it is obviously the point — **balanced**:

```
a throwing step/end observer cannot rewrite the turn outcome
a throwing agent/error listener during a step-error path still balances the turn, loop survives
a pre-commit step/start validation failure does not invent a step boundary
disposal during a running turn ends the turn with reason disposed (balanced)
```

Roughly a third of the contract-regression suite is of the form *a throwing X cannot Y, loop survives*.
The loop's real product is not the answer — it is a **session event log in which every `turn/start` has
a `turn/end` and every `step/start` has a `step/end`**, under arbitrary listener failure. Hence the
`finally` blocks at `agent.ts:291` and `agent.ts:316`, and hence `interrupted` for the crash case.

My model of a harness was "run until done, then return the text." Theirs is "emit a balanced, durable
record; the text is one event in it." That reframing is the finding of this thread.

## Reconciling note 02

Every observation from the blind run, against a line or marked open.

| Observed blind | Reconciled |
|---|---|
| 4 round trips, only 3 in the loop | Confirmed. The 4th is `packages/session/session-title`, a different package. |
| *Is the title call blocking?* | **No.** `defer()` wraps it and `void this.track(run)` discards the promise (`session-title/src/index.ts:683-689`). The loop never awaits it. The capture's ordering was real but proved nothing — which is why it was written as a question. |
| *Does the runtime snapshot accumulate, or get removed?* | **Neither.** See below. |
| Every call streams | Confirmed structurally: `for await (const chunk of stream)` at `agent.ts:347` is the only path. There is no non-streaming branch. |
| The user turn is three messages | Confirmed. The third is appended by the loop itself: `messages: [...claimed, context]` at `agent.ts:238`. |
| It never asked permission | Confirmed, and sharper: **the loop contains no gate to ask with.** It appends `tool/call`, prepares, runs. Any approval must live in the tool runtime's `prepare` or a plugin. → Thread D |
| It never retried | Confirmed, and sharper: retry is opt-in and absent by default. |
| It displayed nothing between steps | Consistent — the loop only appends session events. Rendering is a subscriber. Not proof for the headless profile specifically. |
| It verified its own work | **Still open.** Nothing in the loop causes this. Prompt or model behaviour. → Thread A |

### The superseding snapshot, answered

I framed this as a binary and it is neither. `RuntimeContextProjection.project()` returns `undefined`
when the freshly rendered context is byte-identical to the retained one (`runtime-context.ts:67`). A
snapshot is emitted **only when the context actually changes**. Unchanged turns cost nothing because no
message is created to cost anything.

Two details around it. When context becomes empty it does not fall silent — it emits
`"Current runtime context: none. Earlier runtime-context snapshots no longer apply."`, so a stale
snapshot is never left as the model's most recent word. And if compaction replaces the retained message,
the projection notices (`runtime-context.ts:50-54`) and re-emits on the next step.

The committed measurements confirm the reading without needing the capture, which is gitignored and no
longer on disk:

```chart
kind: bars
title: Messages per request across the run
unit: messages
highlightValue: 2
highlightLabel: the detached title call — not the loop
caption: The three loop requests step 4 → 6 → 8. Exactly two messages per step, assistant plus tool result, never three. A re-injected runtime-context snapshot would have shown as a third.
bars: request | @dsh-canonical.messageCounts
```

## What this says about my toy

The step cap was not a simplification of dsh. It is a **different design**, and knowing that changes
what the cap was ever for. In note 02 my toy hit its cap and ended the run *with no answer at all* — the
cap was load-bearing precisely because nothing else could stop it. dsh removes the need by making every
exit semantic and every exit recorded.

Which raises the obvious objection, and I do not want to lose it: if nothing counts steps, nothing
structurally prevents a model from calling tools forever. The cost ceiling has to live somewhere, and it
is not here. → Thread J

## Questions this opens

- If nothing counts steps, what actually stops a runaway run — cost, tokens, or only the user? → **J**
- Where does a permission gate live, given the loop has none? → **D**
- The loop's product is a balanced event log, and a backend closes crash-orphaned turns on reload. What
  reads it back? → **I**

## Provenance

Source read at `47f9438`; `pnpm vitest run packages/core/agent-loop` reports 18 files, 329 tests, all
passing. Numbers in the chart are the committed `measurements.json`, derived from the Task 2.0 capture
before it was discarded.
