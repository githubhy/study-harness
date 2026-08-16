# O · Agent self-management

Thread O asked: *what tools does a harness give the model for managing its own process, rather than the
user's task?*

It also carried E's question about what a plugin's identity is, such that approving one version can cover
later ones. Read against source at `47f9438`.

Note 02, written blind, listed 25 tool names and said of one: *"`ralph`, I cannot guess from its name at
all."* This is where that gets settled.

## The process tools are ordinary capability seams

| Capability | Seam | Model-facing tool |
|---|---|---|
| Goals | `goal/goal` (1,288) | `tool-goal` (517) |
| Skills | `skill/skill` (898) | `tool-skill` (461) |
| Workflows | `workflow/workflow` (519) | `tool-workflow` (566) |
| Ralph loops | — (rides workflow + subagent) | `tool-ralph` (509) |
| Todos | **none** | `tool-todo` (326) |

The shape is the one Thread D and Thread K found for tools and approval: a **capability seam** with a
service definition, plus a thin model-facing adapter that exposes it as tools. The model's
process-management tools are not a privileged category — they are ordinary plugins over ordinary seams,
which is why they can be restricted per scope (Thread D) and inherited by a child (Thread F) like anything
else.

The exception proves it. **Todos have no service at all**, because the data model does not need one:

> Deliberately minimal: a human-readable `content` line and a three-state `status`. No id, priority, or
> `activeForm` — the list is **replaced wholesale on every write (last-write-wins)**, so entries need no
> stable identity.

A capability that is genuinely a single mutable value gets a tool and nothing else. That restraint is
easier to admire than to practise.

And `workflow`'s seam carries the campaign's recurring move a fifth time: *"Service Providers execute
orchestration scripts; **observe-only lifecycle events never expose run control**."* A plugin can watch a
workflow and cannot steer it, because the events it receives have no steering in them.

## `ralph`, answered

> Model-facing foreground **Ralph loop** over the workflow and subagent seams. A fixed script starts **one
> fresh structured-output child per round**, carrying only the immutable objective and the previous bounded
> handoff between them.

```diagram
kind: chain
title: The Ralph loop: context management by delegation
caption: Each round is a fresh child agent. The only things that cross a round boundary are the unchanging objective and a bounded handoff, so the context a model sees stops growing — without compacting anything.
node: objective | immutable, restated
node: fresh child | new context each round
node: structured output | the bounded handoff
edge: given whole
edge: produces
back: the next round starts clean — nothing else carries over, so context never accumulates
mark: 2 | a subagent, so depth still applies
```

This is a genuinely different answer to the problem Thread C exists for. When a conversation grows past
what is useful, the obvious move is to **compact** it — summarise the middle, drop the old. A Ralph loop
does not compact, because there is nothing to compact: each round is a *new agent* whose context begins
empty except for the objective and a small handoff. Growth is avoided rather than managed.

Two things follow from it being built on the subagent seam rather than on the loop:

- The delegation depth cap applies (Thread F). A Ralph loop spends recursion budget, so it cannot nest
  arbitrarily even though it has no round cap of its own that I can see.
- Each round's child is a full agent with its own session log, so the rounds are individually replayable
  and foldable (Thread E). A compaction step would have destroyed that; this preserves it.

The cost is equally clear: **anything not in the handoff is gone.** Compaction degrades gracefully and
loses detail; a Ralph loop loses everything not deliberately carried, and the quality of the run is
exactly the quality of the handoff schema. That is a design where the interesting engineering has been
moved into a schema, which is a reasonable place to put it.

## Plugin identity, for E

E found that `cordis_run` gates on an *authorized Client Package* and that *"Plugin-wide authorization
covers later versions"*, and asked what identity makes that safe.

The answer is that it is **not automatic**. Approval takes a required flag:

```
approve(requestId: ApprovalRequestId, approveFutureVersions: boolean): Promise<void>
```

`approveFutureVersions` is a required boolean threaded from the approval UI through the client runner to
the host — *"whether this decision covers later Packages of the same Plugin."* There is no default and no
implicit trust: the human approving a model-written plugin decides, at that moment, whether they are
approving this version or the plugin. Identity is the stable `pluginId`; the *scope* of the grant is a
separate, explicit answer.

Given Thread K's finding that grants at the approval seam are one-shot with no allow-always outcome, this
is the one place a durable grant exists — and it is gated behind an explicit checkbox rather than a policy
default.

## Questions this opens

- A Ralph loop has no round cap of its own that I found, only the delegation depth it inherits. Combined
  with Thread J's unbounded Stop-hook continuation, is *any* dsh loop bounded by something other than a
  human? → **J** (reopens)

## Provenance

Source read at `47f9438`. Package line counts from `wc -l` over each `src`; the `approve` signature from
`cordis-client-runner/src/client/index.ts:90`. No capture required.
