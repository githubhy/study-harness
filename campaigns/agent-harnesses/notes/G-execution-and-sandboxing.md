# G · Execution & sandboxing

Thread G was raised by my toy's own shortcut — it ran `bash` with no gate and no confinement at all. The
question is what a harness does instead. Read against source at `47f9438`.

Thread D answered the *permission* half: a three-stage gate, defaulting to allow. This is the other half,
and the two compose into something neither says alone.

## Confinement is real, and it fails closed

`packages/sandbox` is a *"Service Definition for the same-world process-confinement capability seam: wrap
exact subprocess argv under a host-path file policy."* Same-world is stated up front — *"this service
shares the host kernel and filesystem"*, and containers or microVMs *"replace the surrounding capability
seam instead"*. It does not pretend to be isolation it is not.

What it does is OS-level, per platform (`sandbox-local`, 655 lines):

```diagram
kind: chain
title: Every sandboxed command, and the refusal that guards it
caption: Runners are probed by running them, not inferred from the platform. If no candidate provides usable confinement the command does not run at all — the original argv is never returned as a fallback. Cited from packages/sandbox/sandbox-local/src/index.ts.
node: exact argv | from the tool
node: probe runners | bwrap · Landlock · Seatbelt · ACL
node: wrap | enforcement facts recorded
node: execute | confined
edge: to be run
edge: pick a chain
edge: under file policy
back: no usable confinement — refuse, and never fall back to the bare command
mark: 2 | probed by running, once
mark: 4 | modes: read-only · workspace-write · danger-full-access
```

Two details worth taking.

**It probes rather than detects.** *"selects the platform runner chain (Linux bwrap then Landlock; macOS
Seatbelt; Windows the ACL restricted-token runner), **functionally probes competing candidates once**, and
reports each wrap's enforcement and stderr classification facts."* Deciding what confinement is available
by testing it beats deciding from `process.platform`, which is how sandboxes come to be silently absent on
the one distro that matters.

**Missing confinement is a refusal, not a downgrade.** *"Missing or unusable confinement **fails closed
rather than returning the original argv**."* This is the single most important line in the package. The
tempting failure mode — sandbox unavailable, so run it anyway — is explicitly foreclosed.

The Windows implementation is the largest by a distance (`sandbox-windows-acl`, 2,530 lines against 655
for the rest of local), and it carries the most interesting mechanism: the write SID is derived
per-workspace from the canonical path, while *"every live session receives a RANDOM private temp directory
and its own derived capability"*. Sessions cannot reach each other's temp files by guessing.

## Policy is one resolved thing, read by everyone

`sandbox-policy` is *"the single owner of the deployment's sandbox fallbacks plus per-session resolution"*,
and the docstring is explicit that it is the only such owner: *"Enforcing filesystem, one-shot bash, and
terminal backends read the SAME resolved policy here."* Three tool families, one resolution.

And it closes a loop from note 02. That note recorded, blind, a 562-byte `user` message reading *"Current
runtime context. This snapshot supersedes earlier runtime-context snapshots."* Here is what puts things in
it:

> Before each agent request, the owner also contributes the resolved policy to the cache-safe
> runtime-context snapshot. The agent loop logs that snapshot as model history, so **replay reconstructs
> the same mode and root the enforcing consumers resolve without rewriting the stable system prompt.**

So the message I measured without knowing its purpose is how a *replayed* session recovers the sandbox
mode it was actually running under. The prompt stays stable and cacheable (Thread A); the varying policy
rides in history where replay can find it (Thread E). Thread B found the mechanism that emits it only on
change; this is why it exists.

## Escalation, and where it composes with delegation

A sandboxed tool can ask for more. `sandbox/escalation.ts` owns *"the escalation vocabulary and
choreography shared by every sandbox-enforcing tool family (`tool-bash`, `tool-fs`): the **strictly-wider
ladder**, the argument-pairing validation, the model-facing denial/hint markers, and `approveEscalation` —
the ordered fail-closed sequence that resolves a `sandbox_permissions` request through a user-approval
channel **BEFORE anything executes**."*

Three properties in one sentence: escalation only ever widens, approval happens before execution rather
than as a rollback, and both tool families share one implementation *"to keep the two families' approval
ordering and verbatim error texts from drifting apart."*

The channel is taken as *"a minimal STRUCTURAL function shape, not the approval service type"* — the
escalation module never imports approval; the tool layer closes over `ctx.approval.request(...)` and passes
it in. The seam stays thin enough that the sandbox does not depend on the permission system at all.

### A sub-agent cannot widen its sandbox

Thread F found that a delegated child's approval policy is pinned to `'never'` regardless of its parent's.
Here is what `'never'` means:

```
ApprovalPolicy = 'ask' | 'never'
  'never' — never prompt anyone: every ask resolves 'rejected'
```

So a delegated child's escalation request is **rejected before it reaches anyone**. Combined: the parent's
sandbox mode is captured at delegation, the child inherits it, and the child has no path to widen it. You
cannot escape a sandbox by spawning someone to ask on your behalf. That is the real security property of
this design, and it needed Thread F, Thread D, Thread K and this thread to see whole.

## One thing that is wrong

Thread D praised `serviceAsk` for handing the model *distinguishable* denial reasons — *"the three
non-grants deny with distinct reasons so the model can tell a human 'no' from an absent approval
channel."* That precision breaks in exactly one place.

Policy `'never'` resolves every ask to `'rejected'`, and `'rejected'` maps to:

```
`the user rejected tool "${exec.name}"`
```

**No user was consulted.** A delegated child — which is pinned to `'never'` by construction and can never
be anything else — is told a human refused it, every time, when no human was asked. The `'unavailable'`
branch exists and says the honest thing (*"no approval channel is available"*), and this path does not use
it.

It is a small thing with a real consequence: the distinction Thread D correctly identified as valuable
(retry differently for a refusal than for a missing channel) is collapsed for the one caller least able to
find out otherwise. A sub-agent that reasons "the human said no, I should stop asking" is reasoning from a
false premise — which is, admittedly, the behaviour you want here, arrived at by the wrong route.

## Questions this opens

- The escalation ladder is strictly-wider and approval precedes execution. Does a granted escalation
  persist for the session, or is it one-shot like every other grant at that seam? → **D**

## Provenance

Source read at `47f9438`. Quoted docstrings from `packages/sandbox/{sandbox,sandbox-local,sandbox-policy}`
and `sandbox/src/escalation.ts`; `ApprovalPolicy` from `interaction/user-approval/src/index.ts:90-94`. No
capture required.
