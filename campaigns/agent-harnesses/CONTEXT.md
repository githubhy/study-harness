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
