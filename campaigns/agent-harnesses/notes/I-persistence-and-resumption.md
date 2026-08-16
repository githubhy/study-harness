# I · Persistence & resumption

Thread I asked: *what must be saved for a harness to resume a conversation it isn't currently holding in
memory?*

Three threads had queued questions here. B asked what reads back the balanced event log the loop works so
hard to produce. F asked what else is load-bearing in the session header, having found delegation depth
there. K asked what guarantees the log commits at all, and what happens to a session whose store cannot be
written. Read against source at `47f9438`.

## The header is mostly lineage

`SessionHeader` (`core/session/src/types.ts`) has nine fields:

| Field | What it is |
|---|---|
| `version`, `id`, `createdAt` | identity |
| `cwd` | the absolute working directory the session was created in |
| `parentSession`, `seedLength`, `seed` | fork lineage — which session this came from, and how many leading events were seeded from it |
| `origin: 'subagent'`, `delegationDepth` | delegation lineage |
| `agentPreset` | which composition it runs on |

**Five of the nine describe where the session came from, not what is in it.** That answers F's question,
and generalises its finding. F found that `delegationDepth` must be persisted because a resumed child
arriving with fresh runtime options could otherwise delegate as if top-level. The same argument covers
`agentPreset` — a resumed session has to rejoin the *same* composition or it comes back with a different
tool registry — and `origin`, and `seedLength`, which is how a fork knows which of its events it inherited
rather than earned.

So the answer to "what must be saved" is not only the conversation. It is **everything a scope chain would
otherwise have to be asked for at runtime**, because at resume time there is no parent to ask.

## Two backends, one coordinator

- `session-persistence-jsonl` (1,939 lines) — *"a header and contiguous events in one append-only file per
  session"*
- `session-persistence-sqlite` (714 lines)
- `session-persistence` (2,159 lines) — the `PersistenceCoordinator` both delegate orchestration to:
  lazy materialization, crash repair sequencing, dispose quiescence

The backend interface is described as *"the minimal set of durable primitives the orchestration calls"* —
so the coordinator owns the hard parts and a backend only has to append contiguously, truncate a torn
tail, and read back.

## What reads the log back — and why balance was never about tidiness

Thread B found the loop wrapping every boundary in `finally` so that each `turn/start` gets a `turn/end`,
and found `interrupted` — an end reason the loop never emits, written on reload to close a turn orphaned by
a crash. `core/session/src/repair.ts` is that writer, and its module docstring supplies the motive Thread B
could only guess at:

> Crash-recovery repair for an interrupted session log. It preserves a fully written final turn and
> supplies the missing tool, step, and turn boundaries needed **to resume with a provider-valid
> transcript.**

```diagram
kind: chain
title: What a crash leaves, and what repair adds
caption: The synthetic closers exist so the resumed history can legally be sent to a model. A transcript carrying a tool call with no matching result is not merely untidy — it is rejected by the provider. Cited from core/session/src/repair.ts.
node: torn log | turn/start, no end
node: unmatched calls | get error results
node: step/end | synthetic
node: turn/end | reason interrupted
node: provider-valid | resumable
edge: on reload
edge: first, in order
edge: then
edge: transcript closes
mark: 1 | balanced or empty ⇒ nothing added
```

**That is why the balance invariant is load-bearing everywhere.** A transcript containing a tool call with
no matching tool result is not a tidiness problem — it is invalid on the wire, and the next model call
would be refused. So the property is enforced three times over by parties that do not trust each other:
the loop's `finally` blocks produce it, the token meter throws when it is violated (Thread J), and repair
manufactures it after a crash. One requirement, three independent enforcers.

Two named recovery codes mark the two crash windows: *"an assistant tool request that never reached a
recorded call start"*, and *"a recorded tool call whose completed outcome was not durably recorded."*
Repair is deterministic and idempotent — *"a balanced or empty log returns no events"*, sequences continue
the log, and timestamps reuse the last real event rather than inventing a clock reading.

## What happens when the store fails

K's question, and the answer is in two layers that are worth keeping separate.

**Appending is synchronous and validating.** `Session.append` rejects a bad event at the call site:

> The event log is the durable source of truth, so **a bad event fails at the append site rather than later
> during a backend flush.**

**Durability is write-behind.** `session-persistence/write-behind.ts` owns *"bounded per-session write
batching"*, and its dependency list includes:

```
reportBackgroundFailure: (error: unknown) => void
  /** Observe a detached background write failure without rejecting the producer. */
```

A disk write that fails does **not** stop the agent. It is reported, not raised.

So K's audit-pair guarantee — that an approval decision which cannot be appended is not returned — is a
guarantee about **ordering within the log**, not about `fsync` before the tool runs. That is a weaker claim
than it first sounds, and it is still the right one: if the process dies between a grant and its flush, the
tool call it authorised was not durably recorded either, so repair closes that turn as `interrupted` and the
resumed history contains neither. The grant and the action vanish together. What is ruled out is a readable
history in which an action appears without the permission that allowed it.

## Questions this opens

- Repair reuses the last real event's timestamp rather than reading a clock, so a repaired log is a pure
  function of the torn one. Is replay used for anything besides recovery — testing, or the
  `session-projection-cache`? → **E**

## Provenance

Source read at `47f9438`. Header fields enumerated from the `SessionHeader` declaration; line counts from
`wc -l` over each package's `src`. No capture required.
