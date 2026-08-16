# K · The host boundary

Thread K asked: *where does the harness end and the user interface begin — could you drive it with no UI
at all?*

It carried two questions from other threads: J's, whether the reserved `hook` cancel cause is dead or a
seam a host fills; and D's, which hosts register an approval service and what the web UI can do that
headless cannot. Both are answered. Read against source at `47f9438`.

## There are two apps, and neither is the harness

| | |
|---|---|
| `apps/cli` | **6 source files** |
| `apps/web` | **2 source files** |
| `packages/host/apiproxy` | **4,565 lines** |

The CLI's entire import surface is `cordis`, two cordis plugin loaders, and four boot helpers —
`app-boot`, `cmdline`, `home-paths`, `launch-environment`. It does not import the agent loop, the tool
registry, or the API. **It resolves a profile and starts a plugin graph.** Note 00 found from the outside
that dsh boots profiles rather than commands; this is what that looks like from the inside — the command
line is a bootstrapper, and everything the harness does is a plugin under it.

So the boundary is not between "the harness" and "the UI". It is an **RPC surface**, and every UI is a
client of it.

## Three ways to drive it, one of them explicitly for programs

- **`apiproxy`** — the host-side RPC implementation the web client speaks. *"Signature discipline: unary
  takes the narrow `RpcRequest<P>` and echoes `request.rpcId` on the `RpcResponse<T>`."*
- **ACP** (`packages/acp`) — *"Automation-only Agent Client Protocol server over JSON-RPC stdio... exposes
  fresh harness sessions to trusted programmatic clients."*
- **The profile itself** — the headless run in note 00, which mounts no interaction plugins at all.

ACP's own summary draws the line this thread was asking about:

> It carries prompt text, committed assistant text, cancellation, and **one-shot permission decisions**;
> presentation and human-interaction features stay with the harness's UI modules.

So the answer to *could you drive it with no UI* is yes — and more usefully, the thing a UI supplies is
enumerable. Four items cross that seam, and one of them is permission.

## The approval seam, and why headless denies

```diagram
kind: chain
title: One approval request, and the two places it fails closed
caption: The seam is "an answerer or nothing", not "a human or nothing" — an ACP client can answer. Both failure paths land on the same fail-closed outcome, and a decision that cannot be logged is not returned at all. Cited from packages/interaction/user-approval and the tool registry's serviceAsk.
node: tool asks | PreToolDecision ask
node: approval service | requires an open turn
node: composed answerers | UI · ACP · none
node: audit pair | commit or reject
node: outcome | allowed-once · 3 denials
edge: kind ask
edge: request
edge: decide
edge: append
mark: 3 | none ⇒ unavailable
mark: 4 | unlogged ⇒ rejected
```

The module summary is four words long and complete: *"Missing answerers fail closed; grants apply only to
the requested action."* Both halves matter.

**Fail closed, at every level.** No answerer composed → `'unavailable'`. An answerer that throws →
`'unavailable'`. An answerer that returns something outside the vocabulary → *"normalized to
`'unavailable'`"*. Thread D showed the tool registry turning that into a deny with a reason naming the
missing channel. There is no path where an unanswered request becomes permission.

**Grants are one-shot.** The vocabulary is `allowed-once | rejected | cancelled | unavailable`. There is
no "allow always" outcome at this seam at all — a standing policy is a *preset*, recorded separately, not
a grant that outlives its request.

**And an unloggable decision is not a decision:**

> The request requires an open turn because the audit pair must be enclosed by the durable log's
> commit/replay boundary; an idle ask rejects before appending anything... A failure that prevents either
> audit append from committing **still rejects, because returning an unlogged decision would violate the
> pair.**

The permission decision and its audit record commit together or not at all. This is the event-log-as-truth
discipline from Thread B applied where it matters most: **there is no such thing as a granted permission
that was not written down.**

### So: what the web UI can do that headless cannot

Answering D's question precisely — nothing structural. It composes an answerer. The seam, the vocabulary,
the fail-closed defaults and the audit pair are identical in both. Headless denies because nothing is
mounted to answer, not because it is a lesser mode. And because the seam takes an *answerer* rather than a
human, an ACP client can supply one: **a program can hold the permission channel.**

`packages/interaction/permission-presets` sits above this as *"user-facing permission presets over the
independent sandbox-mode and approval-policy knobs"* — `workspace-write`, `danger-full-access`, `custom`,
with approval policy `never` among the settings. Two independent knobs, named combinations over them, and
the preset event *"preserves user intent when two presets share a bundle"* — so the record says what you
chose, not merely what it resolved to.

## The reserved `hook` cancel cause

J found that `cancel()` accepts `{kind:'hook', reason}` and that nothing in the repo constructs one. The
remaining question was whether it is dead code or a seam.

It is a seam. `cancel(cause: AgentCancelCause, options?: CancelOptions): void` appears in the **public
plugin API declaration** carried by `tool-cordis`'s api-catalog — the surface plugin authors write
against. Any plugin can cancel a run and label it as its own decision, distinguishable in the durable log
from a user's interrupt or a parent's.

So the union is not four causes of which one is unused; it is **four causes of which three are used
in-tree and one is left for extensions** — and the reason it exists as a distinct variant rather than
folding into `user` is that the log has to be able to tell them apart afterwards.

That does not change Thread J's conclusion. Nothing shipped stops a runaway run; a plugin *could*, and
the vocabulary is waiting for it.

## Questions this opens

- The audit pair means an approval cannot commit without its log entry. What guarantees the log itself
  commits — and what happens to a session whose store is unwritable? → **I**
- `tool-cordis` publishes dsh's own API surface as a tool catalog. Is that for plugin authors, or is the
  model expected to write plugins at runtime? → **E**

## Provenance

Source read at `47f9438`. Line counts from `wc -l` over `src`; the CLI's import surface from `rg` over
`apps/cli/src`. No capture required.
