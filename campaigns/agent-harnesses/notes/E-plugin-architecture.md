# E · Plugin architecture

Thread E asked what the extension boundary is. It arrived carrying two questions — K's, whether
`tool-cordis` publishing dsh's own API is for plugin authors or for the model; and I's, whether replay is
used for anything besides crash recovery. Both answers turn out to be larger than the questions.

Read against source at `47f9438`. This thread should probably have been pulled first: note 00 observed
from the outside that dsh boots *profiles*, and Thread K found `apps/cli` to be six files that resolve one
and start a plugin graph. This is what they are graphs of.

## The model writes plugins

`packages/extensions/tool-cordis` is 5,984 lines, and its module docstring is one line:

> **Model-facing** Cordis runtime/package inspection, define, run, stop, and remove tools.

Seven tools: `cordis_inspect_list`, `cordis_inspect_query`, `cordis_inspect_self`, `cordis_define`,
`cordis_run`, `cordis_stop`, `cordis_undefine`. So K's question is answered in the strongest available
form — the api-catalog is not developer documentation that happens to live in the repo. **It is the API
reference handed to the model, so the model can extend the harness it is currently running inside.**

The gate is placed carefully, and not where I expected:

| Tool | Gate |
|---|---|
| `cordis_define` | *"does not request approval, execute apply, or change currentPackageId"* |
| `cordis_run` | *"An unauthorized Client Package creates an approval request and returns awaiting-approval; an authorized Package returns starting"* |

**Defining is free; running is gated.** Writing code is inert, executing it is the risk, and the boundary
sits exactly there. The model is told to *"correct the same Plugin and retry autonomously. Do not request
approval again after"* a failure it can fix itself.

Authorization can extend to later versions of the same plugin — but **not automatically**: Thread O found
that `approve()` takes a required `approveFutureVersions` boolean threaded from the approval UI, with no
default. The human decides at that moment whether they are approving this version or the plugin.

### What that composes to

This is where four threads meet, and no one of them could have said it alone:

- The model may define a plugin freely, but running an unauthorized one raises an **approval request** (E)
- Approval is a seam that **fails closed** with no answerer, and grants are one-shot (K)
- The headless profile mounts **no answerer**, so the request denies with a reason naming the missing
  channel (D, K)
- A delegated child's approval policy is **pinned to `never`** regardless of its parent's (F)

Therefore: **the model can extend the harness only where a human is present to say yes, and a sub-agent
can never do it at all.** That is a real security property of the composition, and it is assembled from
four packages that do not reference each other.

## Replay is the computation model, not a recovery path

Thread I found `repair.ts` reconstructing a torn log and asked whether replay was used anywhere else. It
is not a recovery mechanism that happens to exist. It is **how everything outside the loop computes.**

```diagram
kind: chain
title: The event log is the only authority
caption: Domain plugins contribute pure init/apply/view; the framework owns subscription, the watermark cache and change notification, and neither side knows the other. The token meter, session titles, stats and the permissions view are all the same shape.
node: session event log | the only authority
node: projection units | pure init · apply · view
node: watermark cache | a fold shortcut
node: carriers | meter · titles · UI
edge: committed events
edge: driven forward
edge: snapshot + change feed
mark: 3 | stale, never wrong
```

`session-projection` is *"the `ctx.sessionProjections` registry that DRIVES every registered unit forward
eagerly over committed session events. Domain host plugins contribute **pure mathematics
(init/apply/view)**; the framework owns the subscription, the per-session watermark cache, and change
notification... Neither side knows the other."*

And the cache invariant is stated as cleanly as I have seen it written anywhere:

> a fold shortcut, **never an authority**: a row is possibly stale (its `seq` says how stale) but never
> wrong, so every write path is fail-soft (a lost write costs a longer tail replay on the next cold read)
> and a `ver` mismatch **discards the row instead of migrating it**.

Discarding rather than migrating on version mismatch is the detail worth stealing. A cache you can always
rebuild has no migration problem, and pretending otherwise is where caches become authorities by accident.

## What this explains

Every earlier finding in this campaign is a consequence of that one decision.

| Earlier finding | Why, given the log is the authority |
|---|---|
| The loop wraps every boundary in `finally` (B) | An unbalanced log is not a foldable one |
| The token meter throws on a `step/end` with no `step/start` (J) | It is a projection; a malformed fold input is a bug, not data |
| Delegated policy is *appended as events* rather than passed (F) | So the child's effective policy is a projection of the child's own log |
| An approval that cannot be appended is not returned (K) | A decision outside the log does not exist to any projection |
| Depth and preset live in the session header (I) | A projection has to start somewhere, and at resume there is no parent to ask |
| Runtime context is emitted only on change (B) | The log is the thing being appended to; identical snapshots are not events |

The harness is an event-sourced system whose event log doubles as a provider-valid transcript. That single
constraint — *the source of truth must also be legal to send to a model* — is what makes this design
different from ordinary event sourcing, and it is the sharpest thing this campaign has found.

## The category question

For the next specimen the transferable question is not *"does it have plugins"* — everything does. It is:

**What is the authority, and is everything else a fold over it?** A harness whose truth is in-memory
objects with a log written alongside for debugging will differ from this one at every point the table
above lists — and those differences will look like unrelated bugs rather than one decision.

## Questions this opens

- `cordis_run` gates on an *authorized Client Package*, and authorization is plugin-wide across versions.
  What is the identity of a plugin such that a later version inherits the grant? → **O**

## Provenance

Source read at `47f9438`. Tool names enumerated from `tool-cordis/src/index.ts`; quoted docstrings from
`session-projection`, `session-projection-cache`, and `cordis-host-runner`. No capture required.
