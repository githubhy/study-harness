# Agent Harnesses

Glossary for the `agent-harnesses` campaign. Its **subject** is agent harnesses as a category, its
**specimen** is the DeepSeek Harness (`dsh`), and its **transfer specimen** is Claude Code — the three
roles are defined repo-wide in [CONTEXT-MAP.md](../../CONTEXT-MAP.md).

## Language

**Agent harness**:
The scaffolding around a language model that supplies what the model itself has none of — a control
loop, a tool registry, assembled context, and a permission boundary. The unit of study in this campaign.
_Avoid_: Agent framework, agent runtime, agent scaffold

**Eval harness**:
An explicitly **excluded** sense of "harness" — a benchmark runner that scores a model against a fixed
task set (e.g. `lm-evaluation-harness`). Recorded here only so the two senses never drift together.
Nothing in this campaign studies eval harnesses.

**Loop**:
The cycle a harness repeats: assemble context, call the model, parse tool calls, execute them, append
results. Every harness has one; they differ in what they do at each part.

**Step**:
One iteration of the loop — one model call plus whatever tool executions it requests. **Not** the unit a
harness's stop conditions count: neither specimen counts steps at all. The toy caps them at ten, which is
the toy's design and not the category's, and that cap was the reason its measured run ended with no answer.
_Avoid_: Turn, iteration, cycle

**Turn**:
One exchange between a person and the harness — a task in, an answer out. A turn contains one or more
steps. The canonical task was one turn and three steps. Kept distinct from **step** because they are
routinely conflated. The concept transfers between harnesses; its *observability* does not — dsh commits
explicit `turn/start`/`turn/end` events with a closed set of six end reasons, while the transfer specimen
records only a `turn_duration` metadatum and no boundary pair.

**Tool call**:
The model's request to run a named function with arguments, arriving on the assistant message rather
than through any separate channel.

**Tool result**:
What the harness appends after executing a tool call. **Just another message**, competing for the same
context as everything else — which is why truncating results is a context decision and not an I/O one.
The *role* is wire-format-specific and does not transfer: dsh uses OpenAI's role `tool` carrying a
`tool_call_id`; the transfer specimen returns results as `user` records carrying `tool_result` content.
A tool result is also not what the tool returned — see **projection**.

**Context window**:
The message list sent on **every** call. There is no server-side session accumulating it, so growth
compounds: step ten pays for step one again. It is a **projection** of history rather than history itself —
tool-result pruning replaces the middle of an oversized result, and compaction replaces a whole range with
a summary, so what is re-sent is not what was recorded.
_Avoid_: History, conversation, session (which name what is *kept*, not what is *sent*)

**Projection**:
The relationship between what is durably recorded and what any consumer reads. A tool body returns a
canonical value; a pure function renders it into the blocks a model sees. Compaction, pruning and the
token meter are all folds over the same log rather than edits to it. Both specimens work this way; only
one names it.
_Avoid_: View, formatting, serialization

**Sidechain**:
Delegated work recorded inside the delegating session's own log rather than in a separate one. Legible
delegation. The transfer specimen names it and marks every record with a boolean; the specimen has the
thing — in-process children — without a word for it. Opacity tracks the **process** boundary, not the
delegation boundary.
_Avoid_: Sub-agent (which names the worker, not where its record lives)

**Presentation mode**:
How many tools, and in what form, a scope offers the model. Not a property of a harness: the same
registry can present twenty-five tool schemas or a single `run_code` transport. Any claim of the form
"this harness offers N tools" is a claim about a mode.
_Avoid_: Tool set, tool list
