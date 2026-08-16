# A · Prompt & presentation

Thread A asked what a harness tells a model about itself before the task starts. It carried C's question —
what is structurally exempt from compaction — and it is where note 02's last open observation lands.

Note 02 measured a **4,113-byte** system prompt against my toy's 129, opening *"You are an AI agent powered
by DeepSeek Harness."* This is where that number comes from. Read against source at `47f9438`. The prompt
ships in a public MIT-licensed repo, so it may be quoted freely.

## The prompt is not a document. It is a registry.

`packages/core/system-prompt` (605 lines) is a *"registry for ordered system sections, dynamic context, tool
schemas, and prompt variables."* Sections are registered by name and order, by the plugin that owns the
capability the section describes:

```
deployment:persona    order 0        harness:identity      sandbox:policy
approval:policy       plan:policy    subagent:delegation   order 120
tool:bash  tool:read  tool:write  tool:edit  tool:glob  tool:grep
tool:goal  tool:jobs  tool:pty  tool:pwsh  tool:lsp  tool:ralph
tool:cordis  tool:report  tool:session-query  tools:code-only
cordis:include  app:web-surface
```

**Every tool ships its own prompt section.** That is the design, and it has a consequence worth stating
plainly: the prompt is a function of what is mounted. Restrict a tool for a scope (Thread D) and its prose
leaves with it; mount an MCP server (Thread H) and nothing about the prompt needs to change. There is no
central document listing capabilities that can drift out of step with the capabilities themselves — a
class of bug that does not need fixing because it cannot be written.

So the 4,113 bytes note 02 measured is not a chosen length. It is the sum of what the headless profile
mounts, and it is the same sum that produced the 25 tool schemas in the same request.

The ordering is meaningful too. `deployment:persona` is order 0 — a deployment's own voice goes before the
harness's identity. `subagent:delegation` is 120, and its registering comment (Thread F) places it
deliberately *"after the sandbox:policy (110) and approval:policy (115) sentences"*, so a child reads what
it may do before it reads that it is a child.

## Exempt from compaction, by construction

C's question. The answer is that exemption is not a rule anywhere — it is a consequence of where the
prompt lives.

```diagram
kind: chain
title: Why compaction can never touch the system prompt
caption: Sections are re-assembled from the registry on every step and rendered into the request's system field. They are never appended to the session's message history, so the thing compaction operates on does not contain them. The injected runtime context is the opposite case — it is a real user message, and is compactable.
node: mounted plugins | each owns a section
node: ordered registry | name + order
node: assemble() | per step
node: system field | 4,113 B in our run
edge: register at mount
edge: sorted by order
edge: rendered
back: rebuilt from scratch every step — it never enters history, so compaction has nothing of it to find
```

Thread B found `systemPrompt.assemble(...)` called inside `preStep`, once per step, with `renderPrompt`
producing the `system` string for the request. Compaction (Thread C) selects a range of *history* and
replaces it with a summary. The system prompt is not in that history — it is rebuilt every step — so there
is no rule exempting it and none is needed.

The contrast makes the point. The injected runtime-context snapshot **is** a real `user` message in the
history (note 02 saw it, 562 bytes, and Thread B found it appended at `agent.ts:238`). It is therefore
fully compactable — and it is also the thing that re-emits itself when it changes. A harness that put its
system prompt in the message array would have had to invent a pinning rule; this one does not have the
problem.

## Note 02's last open observation

Note 02 recorded, blind: *"It verified its own work. It did not write the file and report success; it ran
the file and the tool result contains the real interpreter output... My toy did this too, but only because
the task said to — worth checking whether dsh does it when unasked."*

Sweeping every prompt section in the repo for an instruction to verify turns up exactly one, and it is not
in the base prompt:

```
packages/goal/goal-round-driver/src/prompt.ts:20
  "...earlier narration is still current. Make concrete progress and verify the result."
```

That belongs to the **goal** subsystem — a driver for multi-round goal execution, not something a plain
headless run mounts. **Nothing in the base system prompt instructs the model to verify its work.**

Which resolves the observation, though not the way the note hoped. Our canonical task was *"...then run it
with node and show me the output"* — the task said to. So that run is not evidence of harness-driven
verification either way, and my toy and dsh were under identical instructions after all.

What remains genuinely open is behavioural, not structural: whether the model verifies unasked. That needs
a capture with a task that does not request it, and it is a claim about the model as much as the harness.
Recorded as open rather than answered.

## Questions this opens

- The prompt assembles from mounted plugins, so two profiles produce different prompts from the same
  binary. `--dump-config` exists (note 00). Is the assembled prompt inspectable without running a task? → **M**

## Provenance

Source read at `47f9438`. Section names and orders from `rg` over the registration call sites; the
verification sweep covered every `prompt*.ts` under `packages/*/*/src`. The 4,113-byte figure is from the
committed `measurements.json`, derived from the Task 2.0 capture. No new capture taken.
