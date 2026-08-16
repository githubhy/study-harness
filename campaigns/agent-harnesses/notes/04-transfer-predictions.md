# 04 · Transfer predictions

Phase 4, part one. **Written and committed before opening a single Claude Code transcript.** The scoring
lives in `notes/05-transfer-scored.md`; if that file exists in the same commit as this one, the discipline
was not kept.

## The validity problem, stated before the test rather than after

The plan asks me to predict how Claude Code behaves and then score myself against transcripts. **I am
Claude Code.** For most of these rows that is not prediction, it is recall, and a recall test measures
nothing about whether a vocabulary transfers.

There is a second, milder contamination: Threads J and F found dsh ships an explicit model of Claude
Code — a hook-protocol bridge and a driver that spawns the real Agent SDK — so I have read *dsh's reading*
of the transfer specimen. I flagged in note J that this describes dsh's model rather than the thing itself,
but it still informs these rows.

So each prediction below carries a **contamination label**, and the scoring will report the two groups
separately:

- **RECALL** — I have inside knowledge; a correct answer proves nothing, a *wrong* one is genuinely
  informative because it means my self-model is off.
- **INFERENCE** — genuinely derived from dsh plus the transcript's observable shape.

The part of Phase 4 that survives intact is the **glossary sort**: whether vocabulary built from dsh is
adequate to describe a second harness is a question about the *terms*, not about facts I might know. That
is the real deliverable here, and it is in `notes/05-transfer-scored.md` too.

## The eight ledger rows

**1 · Which tools exist and get called** · RECALL
Claude Code offers on the order of 15–20 tools, named in TitleCase (`Read`, `Write`, `Edit`, `Bash`,
`Glob`, `Grep`, `Task`, `TodoWrite`, `WebFetch`, `WebSearch`) rather than dsh's `snake_case`. Expect
`Read`/`Edit`/`Bash` to dominate call counts, and a long tail of tools that appear in almost no transcript.
*Falsified by*: snake_case names, or a flat call distribution.

**2 · How the loop terminates** · INFERENCE
Same as dsh: semantically, when the model stops emitting tool calls. I predict **no step cap** visible in
transcript structure — no run ending at a suspiciously round number of assistant turns. I also predict
transcripts show runs of highly variable length with no clustering at any particular count.
*Falsified by*: a modal run length at a round number.

**3 · How permissions are gated** · RECALL
Per-tool, before execution, with a persistent allow-list — unlike dsh, where Thread K found grants are
strictly one-shot and a standing policy is a separate *preset*. I predict Claude Code's grants persist per
tool-plus-argument-pattern within a project.
*Falsified by*: evidence of one-shot-only approval.

**4 · Whether hooks can block** · RECALL, informed by dsh's bridge
Yes. Thread J read dsh's bridge, which maps `PreToolUse` `deny` and `ask`, and `Stop` `deny` to forced
continuation. Since that bridge is written against the real format, I predict Claude Code has the same
semantics natively, including `stop_hook_active` actually being set — the field dsh hardcodes to `false`.
*Falsified by*: the bridge's event set not matching what transcripts show firing.

**5 · Whether sub-agents fork context** · RECALL
Sub-agents get a **fresh** context, not a fork — a task description in, a report out. That is the same
shape as dsh's `SubagentResult` (Thread H: output blocks, optional structured value, stop reason). I
predict transcripts show a sub-agent's internal steps absent from the parent's transcript.
*Falsified by*: parent transcripts containing child tool calls inline.

**6 · Whether the model reasons before acting** · INFERENCE
Yes, and visibly — a narration message before the first tool call, as note 02 observed dsh doing. I predict
this is a model habit rather than a harness instruction, and therefore appears in both.
*Falsified by*: transcripts showing tool calls with no preceding assistant text.

**7 · What the system prompt says** · RECALL
Not directly visible in transcripts (the prompt is not stored in the message log), so this row is likely
**unscoreable** from this evidence. I predict I cannot score it, which is itself the finding: Thread A
could read dsh's prompt because dsh is open source, and the transfer specimen affords no equivalent.
*Falsified by*: transcripts containing the system prompt.

**8 · What the tool schemas declare** · RECALL
Likewise not in transcripts — only *calls* are, with their arguments. I predict I can recover argument
*shapes* by observing calls but not the declared schemas, and specifically that I will **not** be able to
tell whether Claude Code separates a canonical value from a rendered projection the way Phase 3 found dsh
doing. That distinction is invisible from the outside, which is exactly why Phase 3 had to build the tool
twice instead of watching one.
*Falsified by*: schema declarations appearing in the log.

## What I expect the shape of the result to be

Rows 7 and 8 unscoreable, rows 1 and 5 confirmed as recall, row 2 the only genuinely interesting
inference. If that is how it lands, the honest summary of Phase 4 is that **transcripts are a weak
instrument for architectural questions** — they show what happened, not what the harness is — and the
campaign's real transfer evidence was the thing Thread J stumbled on: dsh's own executable model of Claude
Code, which is source rather than observation.

## Provenance

Written 2026-08-16 against no transcript. `~/.claude/projects` holds 4,019 `.jsonl` files across 21 project
directories; that count is from `find`, taken before writing this note, and no file was opened. Transcripts
are personal working history: the scoring note will cite structure, counts, and tool names only, never
conversation content.
