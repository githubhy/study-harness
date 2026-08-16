# J · Observability & cost

Thread J asked: *how does a harness let someone outside the loop observe it — or interrupt it?*

Pulled because Thread B left an objection I did not want to lose. If nothing counts steps
(`notes/B-agent-loop.md`), something else has to be able to stop a run. The answer is that **nothing
inside dsh can**, and the one seam that could extend a run indefinitely is reachable from an unmodified
third-party hook config. Read against source at `47f9438`.

## Observation is total, and deliberately powerless

Everything outside the loop watches the same thing: the session event log the loop is obliged to keep
balanced. `packages/llm/token-meter` is the representative consumer — 999 lines that fold `step/start`,
`assistant/chunk` and `assistant/message` events into a running token projection.

It cannot be given a budget. Its config validator is one line:

```
throw new Error(`TokenMeterConfig: unknown key "${key}" (no settings are supported)`)
```

*No settings are supported.* Every other `throw` in the package is an **event-log invariant**, not a
usage threshold:

```
token meter: step/end at seq N has no matching step/start event
token meter: assistant/message at seq N source seq M is not assistant/chunk
```

That is Thread B's balance invariant again, now enforced from outside by a consumer. The loop keeps the
log balanced as a discipline; the meter treats it as a contract and throws when it is violated. Two
packages, one property, neither trusting the other.

So the token meter measures and reports. It never stops anything. **There is no cost ceiling in dsh.**

### The invariant registry, and a correction to note 00

Every workspace package registers runtime checks from a `./invariant` companion, collected by
`packages/runtime-diagnostics/invariants`. Counting them to see how real that claim is turned up
something else:

| | |
|---|---|
| Top-level entries under `packages/` | **49** — and none is a package: zero `package.json` at that depth |
| Leaf packages (`packages/*/*/package.json`) | **219** |
| Leaf packages with `src/invariant.ts` | **219 — all of them** |

**Note 00 is wrong where it says "there are exactly 49 package directories."** Those 49 are *groups*;
the specimen has 219 packages. The census and `specimen.packageCount` still describe the 49 groups they
enumerate, which is a coherent claim — but the word "packages" was doing two jobs. Corrected in note 00
and in the census heading.

The invariant coverage is the finding, though: 219 of 219. Not a convention some packages follow — a
registry every package is in.

## Interruption: four causes, three producers

Cancellation is one method, `cancel(cause)` (`agent-loop/src/agent.ts:134`), and the cause is a closed
union of four (`core/session/src/types.ts:143-147`). Tracing every call site outside tests:

| Cause | Produced by | Notes |
|---|---|---|
| `user` | `host/apiproxy/src/api-proxy.ts:2631`, `acp/acp/src/index.ts:341,365` | the API proxy passes `keepInbox: true`; ACP does not |
| `parent` | subagent driver `:166`, `subagent/continuation.ts:1302`, `goal-round-driver:435` | a delegating agent killing its child |
| `disposed` | `agent-loop/src/index.ts:507` | lifecycle teardown |
| `hook` | **nobody** | declared in the type, produced nowhere in the repo |

Two things worth keeping. The `hook` cause is a **reserved variant with no producer** — the type
anticipates a plugin cancelling a run, and nothing in dsh does it. And the same primitive behaves
differently per host: interrupt from the web API and your queued input survives (`keepInbox: true`);
interrupt over ACP and the inbox is cleared. Same call, two policies, decided by the host.

## dsh runs other harnesses' hooks

This is the part I did not expect at all. `packages/hooks` holds three packages:

- `hook-protocol` (854 lines) — shared execution and parsing
- `hooks-claude-code` (514) — *"Bridge for unmodified Claude Code command hooks"*
- `hooks-codex` (445) — *"Bridge for unmodified Codex command hooks"*

Both map a foreign hook config onto dsh's own interception seams. Seven points for Claude Code, five
for Codex, onto the same cordis events:

| Hook point | dsh seam | CC | Codex |
|---|---|---|---|
| SessionStart | `agent/session-start` | ✓ | ✓ |
| UserPromptSubmit | `agent/pre-step` | ✓ | ✓ |
| PreToolUse | `tools/pre-execute` | ✓ | ✓ |
| PostToolUse | `tools/post-execute` | ✓ | ✓ |
| Stop | `agent/turn-stopping` | ✓ | ✓ |
| SubagentStart / SubagentStop | `subagent/start`, `subagent/end` | ✓ | — |

A `PreToolUse` hook returning `deny` blocks the call before it runs; returning `ask` escalates to a
human — **and `ask` is Claude-Code-only.** The Codex bridge states its own limit: *"no pre-tool approval
or rewrite path; only blocking decisions are honored."* Two dialects on one seam, and they do not have
equal power over it.

Two capabilities are accepted and then dropped, with a warning rather than an error
(`hooks-claude-code/src/index.ts:175-180`):

```
hooks-claude-code: <point> hook requested updatedInput, which is not yet honored (ignored)
hooks-claude-code: <point> hook emitted a systemMessage, which is not yet surfaced (ignored)
```

So "runs unmodified Claude Code hooks" is true, and a config using either feature degrades to a log
line. Worth knowing before trusting the word *unmodified*.

## The answer to Thread B's objection, and it is worse than I expected

A `Stop` hook that returns `deny` does not stop anything — **it forces the turn to continue**, by
steering at exactly the boundary Thread B found:

```
agent.steer(createUserMessage({ content: [{ type: 'text', text }], source: PLUGIN_SOURCE }))
```

That is `agent/turn-stopping` refilling the inbox so `turnEnds && nextStep.length === 0` fails and the
turn runs another step. Thread B found the mechanism; this is what uses it.

```diagram
kind: chain
title: A blocking Stop hook, and the guard that is not there
caption: The forced-continuation cycle. Both bridges implement it; neither supplies stop_hook_active, which is the signal a hook would need to notice it is inside this loop. Cited from hooks-claude-code/src/index.ts:267-277 and hooks-codex/src/index.ts:255-268.
node: turn wants to stop | reason set, inbox drained
node: Stop hook runs | foreign config
node: deny | exit 2 is enough
node: steer() | inbox refilled
edge: agent/turn-stopping
edge: decision
edge: forces continuation
back: nothing counts these — TODO(stop-loop-guard) in both bridges, and the turn never ends
mark: 4 | no cap
```

Both bridges carry a `TODO(stop-loop-guard)` and both defer the fix to hook authors —
*"hooks must self-limit meanwhile."* But the signal a hook self-limits **with** is hardcoded off. The
Codex bridge says so in full:

> `TODO(stop-loop-guard)`: Codex supplies `stop_hook_active` so a Stop hook can avoid continuing the
> same turn indefinitely. **It is always false here**, so an unconditionally blocking hook
> force-continues every step until it self-limits.

`stop_hook_active: false` is a literal in both bridges (`hooks-claude-code:346`, `hooks-codex:261`). A
hook is told *"this is not a re-invocation"* on every re-invocation. The mitigation the TODO delegates
to hook authors is the one thing the bridge prevents them from doing.

The Codex path is sharper still: a block **with no reason** — exit 2 and empty stderr — still forces
continuation, falling back to a generic steering line *"rather than letting the turn stop."* An
accidental non-zero exit from a hook script is an infinite loop in a harness with no step cap.

So, closing `b-runaway`: nothing internal stops a runaway run. No step cap (B), no token budget (J), no
hook-initiated cancel. Only a user, a parent agent, or teardown. And the same extension surface that
cannot stop a run **can prevent one from ending**, without limit, from a config file written for a
different harness. All of it is documented in-source; none of it is hidden.

## Every bound is per-unit. None is cumulative.

*Added 2026-08-16, answering the question Thread O reopened here: with no step cap, unbounded Stop-hook
continuation, and Ralph loops carrying no round cap of their own, is any dsh loop bounded by anything
other than a human?*

Rather than fail to find a limit and infer absence, I swept the repo for every ceiling it defines. The
complete list, by what each one governs:

| Bounds | Constants |
|---|---|
| one tool call | `timeoutMs` (cooperative — the tool must honour `exec.signal`) |
| one model call | `maxTokens`, `maxOutputTokens`, `DEFAULT_MAX_RETRIES` |
| one request | `DEFAULT_MAX_USES` (`web_search` server-tool uses **per request**) |
| one step | `maxParallelToolCalls` |
| one delegation chain | `maxDepth` (default 3) |
| one payload | `DEFAULT_MAX_*_BYTES` — request body, message, image, document, stderr, spill, result, source, reference |
| concurrency | `DEFAULT_MAX_CONCURRENT_TASKS_PER_OWNER` |

**Not one of them bounds a run.** There is no step cap, no turn cap, no session token budget, no
wall-clock deadline, no Ralph round cap, and no cost ceiling. Every limit in the system governs the size
of one unit of work or how many may be in flight; none governs how many units a run may consume.

That is a deliberate and coherent position — it is the same position as "termination is semantic" from
Thread B, applied to cost. It is also the reason the `TODO(stop-loop-guard)` above matters more than a
missing guard normally would: it is not one hole in a fence, it is the fence.

## What this does to the transfer ledger

The ledger's row *"whether hooks can block"* was to be answered by comparing dsh against Claude Code
transcripts. It does not need to be. **The specimen ships an explicit, executable model of the transfer
specimen's hook protocol** — the mapping, the decision semantics, and a documented list of what it
declines to implement, in an MIT-licensed public repo.

That is better evidence than a transcript, and it is quotable. It also cuts the other way: the bridge
is dsh's *reading* of Claude Code, so where it is wrong or partial it tells me about dsh's model of the
transfer specimen, not about the transfer specimen. Both are worth having, and they are not the same
thing.

## Questions this opens

- `PreToolUse` can return `ask` — so the permission gate exists at the tool seam, not the loop. Who
  renders that prompt, and what happens headless where nobody can answer? → **D**
- `SubagentStart` can inject context into a child. Does a child inherit the parent's hook config? → **F**
- The `hook` cancel cause is reserved and unused. Is it dead, or a seam a host is expected to fill? → **K**

## Provenance

Source read at `47f9438`. Counts from `find`/`rg` over the checkout, stated with the command shape that
produced them. No capture required; nothing in this thread needed a running model.
