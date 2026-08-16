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
One iteration of the loop — one model call plus whatever tool executions it requests. The unit a
harness's stop conditions count. Observed: the toy caps steps at ten and counts nothing else, so a
step costing 300 tokens and one costing 10,416 are indistinguishable to it.
_Avoid_: Turn, iteration, cycle

**Turn**:
One exchange between a person and the harness — a task in, an answer out. A turn contains one or more
steps. The canonical task was one turn and three steps. Kept distinct from **step** because they are
routinely conflated and the difference is where stop conditions live.

**Tool call**:
The model's request to run a named function with arguments, arriving on the assistant message rather
than through any separate channel.

**Tool result**:
What the harness appends after executing a tool call. Observed to be **just another message** — role
`tool`, carrying the `tool_call_id` it answers. It occupies the same context as everything else and
competes with it for room, which is why truncating results is a context decision and not an I/O one.

**Context window**:
The complete message list sent on **every** call. Re-sent in full each step; there is no server-side
session accumulating it. This is why growth compounds: step ten pays for step one again.
_Avoid_: History, conversation, session (which name what is *kept*, not what is *sent*)
