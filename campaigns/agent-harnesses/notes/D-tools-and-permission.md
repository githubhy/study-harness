# D · Tools & permission

Thread D asked: *what must a harness be told about a tool, and where does the permission boundary sit?*

Pulled because two threads converged on it. B found the agent loop has no gate to ask with; J found that
a `PreToolUse` hook can return `ask` and wanted to know who answers when nobody is there. And note 02
recorded, blind, that dsh *"never asked permission"* — on a headless run, which turns out to be the
interesting case. Read against source at `47f9438`.

## The model is told three things. The harness is told seven more.

```
interface ToolSchema { name; description; parameters }        // what goes on the wire
interface ToolDefinition extends ToolSchema {
  output            // mandatory canonical output declaration
  execute()         // returns a JSON value, never model-facing text
  finalizeContent?  timeoutMs?  isConcurrencySafe?  presentCall?  presentResult?
}
```

The split is not incidental — each extra field is consumed by a different subsystem. `isConcurrencySafe`
decides whether a call may join the ≤10 parallel batch that is the agent loop's only tunable (Thread B).
`timeoutMs` feeds `packages/guard/timeout-policy`. `presentCall` and `presentResult` belong to the host,
not the model. **The wire schema is the smallest part of what a harness needs to know about a tool.**

### A tool never produces text

`execute()` returns *"only its canonical lossless-JSON value"*, validated against `output.schema`. What
the model reads is a **pure projection** of that value:

```
render(args: unknown, value: JsonValue): ContentBlock[]
```

```diagram
kind: chain
title: A tool result is projected, not written
caption: The body returns a typed value; a pure function renders it for the model. One mechanism behind three separate observations — why results replay identically, why Code Mode can hand a program the value, and why note 02 saw a structured wrapper where the toy returned a sentence.
node: execute() | returns JSON only
node: output.schema | validated
node: render() | pure projection
node: content blocks | what the model reads
edge: canonical value
edge: on success
edge: args + value
mark: 1 | a program takes it here
mark: 4 | the model takes it here
```

This reconciles an observation from note 02. I recorded that dsh's `write` result came back as
`<path>…`, *"some structured wrapper"*, where my toy returned the sentence `wrote fizzbuzz.js`. That
wrapper is `render()`. The toy had no value/text split at all, so its tool body had to decide how to
address the model — which is why its results were prose, and why they could not be replayed or reused.

## The boundary is three mechanisms, not one

```diagram
kind: chain
title: Every tool call, in order
caption: Three separate stages with different powers. Only the middle one is negotiable. Cited from packages/core/tools/src/index.ts — restrict at :1071, the pre-execute waterfall at :1475, guards at :1119, dispatch at :1503.
node: visible? | restrict, per scope
node: pre-execute | allow · deny · ask
node: guards | deny-only
node: dispatch | the tool body
edge: in the schema list
edge: default allow
edge: no reason given
mark: 1 | the model never sees it
mark: 2 | ask → deny if no channel
mark: 3 | order cannot un-deny
```

**1 · `restrict` removes the tool from view.** A restriction filters what a scope *inherits*, producing
a `visible` map. A restricted tool is not denied — it is absent from the schemas the model is offered,
so it is never called and never learns it was refused.

Two details worth stealing. `tools.restrict({})` **throws**: *"an empty filter is almost always a
materialized-empty-config bug."* And a restriction naming an unknown tool throws at registration, listing
the known names. A typo in a security config is a startup error rather than a rule that silently matches
nothing — which is the classic way permission configs fail open.

**2 · `tools/pre-execute` is the negotiable stage,** and its default terminal is the answer to note 02:

```
const gate = await this.ctx.waterfall(
  carrier, 'tools/pre-execute', exec,
  () => Promise.resolve<PreToolDecision>({ kind: 'allow' }),      // index.ts:1477
)
```

**With no plugin listening, every tool call is allowed.** dsh did not decline to ask permission on our
headless run; there was nothing installed that wanted to be asked. Permission is opt-in, and the profile
we ran opts out. That is a much narrower claim than "dsh doesn't do permissions", and note 02 was right
to record only what it saw.

**3 · Guards cannot be argued with.** A `ToolGuard` returns `string | undefined` — a denial reason, or
nothing. There is no allow value, and the docstring says why:

> Because guards have no allow result, **listener ordering cannot turn a denial back into permission.**

They evaluate global-first, then the scope chain farthest-first, taking the first denial. So a policy
that must not be negotiable goes here, and a policy that should be is a `pre-execute` listener. The two
stages exist because those are different requirements.

## What happens when `ask` has nobody to ask

This is J's question, and the answer is that it **fails closed and says which kind of closed**
(`index.ts:1689-1728`). Five outcomes, four of them denials with distinct reasons:

| Situation | Reason handed to the model |
|---|---|
| no `approval` service registered | `tool "X" requires approval (not yet supported)` |
| no agent to route through | `tool "X" requires approval, but the call has no agent to route it through` |
| a human said no | `the user rejected tool "X"` |
| approval cancelled | `approval for tool "X" was cancelled` |
| no channel available | `tool "X" requires approval, but no approval channel is available` |

The docstring is explicit about the audience: *"the three non-grants deny with distinct reasons so the
model can tell a human 'no' from an absent approval channel."* Those warrant different behaviour — a
refusal is a decision to respect, a missing channel is an environment problem to report — and the model
can only distinguish them if the harness bothers to. Most would return one string.

So on a headless run an `ask` becomes a deny, and the model is told it was the channel, not the human.

## Code Mode: one tool instead of twenty-five

Following the gate turned up a presentation mode I had no idea existed. When a scope's
`ToolPresentationMode` is `code`, the schemas offered to the model are filtered to exactly one —
`run_code` (`index.ts:994-998`). The model writes a program; the program calls the tools.

`run_code` is reserved unconditionally and cannot be registered or shadowed, because *"any agent may
select a code mode for itself, so a name free to take under the deployment default would become a
collision the moment a preset mounted."*

The obvious worry is that this is a permission bypass — a script calling tools behind the gate's back.
It is not. `code-mode.ts:481` fetches the same `registry[TOOL_RUNTIME_SCHEDULER]` the agent loop uses at
`tool-calls.ts:169`, and `prepare` is the stage that runs the waterfall and the guards. **One gate, both
paths.** Nested calls are scheduled under the same concurrency contract, and each sub-dispatch is logged
— though *"only the outer curated result enters model history"*, which is a context question for C.

This also means "25 tools offered" in note 02 is a fact about a *presentation mode*, not about dsh. The
same registry can present itself as 25 schemas or as one.

## The principle showing up twice

Thread B found that a tool ends a turn by setting `concludesTurn` on its result, and the docstring said
*"data decides, so listener order cannot change the outcome."* Thread D finds guards with no allow
value, so *"listener ordering cannot turn a denial back into permission."*

Two subsystems, same move: where ordering between independent extensions could produce a wrong answer,
**make the wrong direction unrepresentable** rather than documenting a required order. That is worth
carrying to the next specimen as a question — it is a property of the extension model, not of tools.

## Questions this opens

- `restrict` narrows what a scope inherits, and guards evaluate the scope chain farthest-first. That is
  the delegation-safety story. Does a child actually inherit its parent's restrictions? → **F**
- Code Mode puts only the outer result in model history while sub-dispatches are logged separately.
  What does that do to the context curve? → **C**
- The `approval` service is fetched from the context and may simply be absent. Which hosts register one,
  and what does the web UI do that headless cannot? → **K**

## Provenance

Source read at `47f9438`. No capture required. Every quoted docstring is from the specimen's own source,
which is public and MIT-licensed.
