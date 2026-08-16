# F · Delegation & sub-agents

Thread F asked: *when does a harness spawn another harness, and what does the child inherit?*

Both D and J had converged on the inheritance half — D wanted to know whether a child inherits its
parent's tool restrictions, J whether it inherits the parent's hook config. The answer to the first
question turns out to be more literal than the thread intended: **dsh spawns Claude Code and Codex.**
Read against source at `47f9438`.

## The one recursion budget in a harness with no step cap

Thread B established that nothing counts steps. Delegation is the exception: `maxDepth` defaults to
**3**, and `0` forbids delegation entirely (`tool-subagent/src/index.ts:69-78`).

Depth is monotone, and the docstring names the escape it closes:

> The persisted session header is authoritative and monotone: runtime `AgentOptions.subagentDepth` may
> DEEPEN the count but can never lower it — **a resumed child arrives with fresh options, and counting it
> from zero would let it delegate as if it were top-level.**

Resume a child, reset its depth, and the recursion budget is gone. Closing that requires the *persisted*
header to win over runtime options, which is why depth lives in the session log rather than in the call.
That is a delegation bug reachable only through persistence — F and I sharing an edge.

## What actually crosses the boundary

```diagram
kind: chain
title: What crosses the delegation boundary
caption: Composition is linked; policy is snapshotted. The split is deliberate — a later parent switch belongs to the parent's future, not to this child. In-process children only: the foreign-harness drivers seed none of this.
node: parent | depth d
node: capture policy | before first await
node: seed child log | source: delegation
node: join composition | scope-chain link
node: child | depth d+1
edge: subagent tool
edge: sandbox + approval
edge: composeFrom
edge: restrict intersects
mark: 2 | approval pinned to never
mark: 5 | cap 3 by default
```

**Composition is linked, not copied.** `composeFrom` binds the child's scope key to the parent's standing
mount — `bindScopeParent(agentKey, standing.key)`. The child does not receive a snapshot of the parent's
tools, prompt sections, skills or plugins; it joins the same preset through the scope chain. So J's
question is answered: a child inherits the parent's hook and plugin composition because it is *on* it,
not because anything was copied to it.

**Per-child restriction intersects on top.** `applyChildComposition` ends with
`childCtx.tools.restrict(composition.toolFilter)`, and the surrounding comment states that a per-child
restriction *"intersects with everything its chain admits."* So D's question is answered too: a child can
narrow, never widen. Combined with Thread D's guard-chain walk (global first, then the scope chain
farthest-first) the whole tool-permission story is one-directional down a lineage.

**Policy is captured, not linked** — and captured *synchronously*, before the child's first await,
because *"a later parent switch belongs to the parent's future, not to this child."* A parent that
loosens its sandbox after delegating does not loosen the child. That is a time-of-check/time-of-use gap
closed by construction rather than by locking.

The captured policy is then appended to the child's own log as `source: 'delegation'` events, *"so the
child's effective policy is reconstructable from its log alone"* — the same event-log-as-truth discipline
Thread B found in the loop and Thread J found the token meter depending on.

### A sub-agent can never ask a human

The sharpest line in the file:

```
approvalPolicy: parent.ctx.get('approval') === undefined ? undefined : 'never'
```

*"`'never'` whenever the approval capability is composed... a delegated child acts only within the
sandbox scope fixed at delegation, so its asks are rejected deterministically."*

**Pinned to `never` regardless of the parent's own policy.** With Thread D's result — an `ask` with no
channel becomes a deny carrying a reason — a child that tries to escalate gets a deterministic refusal
and is told why. You cannot widen your permissions by delegating to someone who asks on your behalf.

## dsh spawns other harnesses

Thread J found dsh *running* Claude Code's and Codex's hook configs. This is stronger. Two of the eleven
subagent packages are drivers for competitors' actual runtimes:

| Package | What it starts |
|---|---|
| `subagent-claude-code` (604 lines) | *"invokes the official Agent SDK in the delegating Session's workspace and places the SDK-spawned real CLI under the shared subprocess owner"* |
| `subagent-codex` (705 lines) | *"starts a fresh official `codex app-server --stdio` process in the delegating Session's workspace"* |
| `subagent-acp`, `subagent-dsh-sdk` | protocol and out-of-process dsh children |
| `subagent-in-process-driver`, `-fork-in-process`, `-spawn-in-process` | children inside this process |

So the transfer specimen is not only something I compare dsh against from the outside — **dsh executes
it.** For the transfer ledger that is a third kind of evidence, after transcripts and after J's hook
bridge: an integration that has to actually work.

### And the guarantees stop at the process boundary

This is the part worth being careful about. `captureDelegatedPolicyOverrides` and
`appendDelegatedPolicyOverrides` are called from exactly two places — `continuation.ts:426,1001` and
`subagent-in-process-driver:117,121`. **The foreign-harness drivers call neither.**

That is correct rather than sloppy: you cannot seed a `sandbox/mode` event onto a session log a Claude
Code process does not have. But it means the careful story above — approval pinned to never, restrictions
intersecting, depth monotone — describes **in-process children only**. A real Claude Code child runs on
its own policy engine, and dsh says so in the config surface rather than pretending otherwise:

> `'provider-managed'` is for an out-of-process provider whose recursion budget belongs to the child
> runtime or its own deployment.

And a numeric cap *"requires the provider's `depthLimit` capability (**mount fails loud** otherwise)."*
You cannot configure a depth cap against a provider that cannot enforce it. Same shape as Thread D's
`restrict()` rejecting unknown tool names: a policy that would silently do nothing is a startup error.

## Hide what is absent; show and reject what is unavailable

One deliberate contrast with Thread D. `restrict` removes a tool from the model's schema list entirely.
The depth cap does not:

> The provider checks the calling agent's current depth at every start; **the tool remains model-visible
> so runtime policy owns rejection.**

A restriction is static — the tool will never be available to this scope, so hiding it saves the model
from planning around something it cannot have. Depth is dynamic — the same agent may delegate at depth 1
and be refused at depth 3 — so the tool stays visible and the refusal carries a reason. Two different
answers because they are two different kinds of unavailability.

## The principle, a fourth time

Threads B, D and now F keep turning up the same move. `concludesTurn` is data so listener order cannot
change the outcome. Guards have no allow value so ordering cannot un-deny. Depth is monotone so a resume
cannot reset it. And `applyChildComposition` takes the parent as a parameter specifically so that
composing a child *without* joining its parent — which would silently give it an empty tool registry —
is *"unrepresentable at the call sites."*

Four subsystems, one law: **where a mistake would be silent, make the mistake impossible to express.**
Not documentation, not ordering rules, not a lint — a type or signature that has no room for the wrong
answer. That is the most transferable thing this campaign has found so far, and it is a claim about
extension models generally, not about dsh.

## Questions this opens

- A foreign child runs on its own policy engine. What does dsh actually get back from a Claude Code
  child — just text, or structured events it can audit? → **H**
- Depth is persisted in the session header because runtime options cannot be trusted after a resume.
  What else is load-bearing in that header? → **I**

## Provenance

Source read at `47f9438`. No capture required. Quoted docstrings are from the specimen's public
MIT-licensed source.
