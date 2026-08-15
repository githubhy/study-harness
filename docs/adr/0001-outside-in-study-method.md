# Study agent harnesses outside-in, with dsh as specimen and Claude Code as transfer test

**Scope:** repo-wide. This records the method every campaign uses; the `agent-harnesses` campaign is its first application, and the specifics below are that application.

The subject of the `agent-harnesses` campaign is agent harnesses as a category, not the DeepSeek Harness in particular. We study outside-in: capture the wire traffic a harness sends to the model API first, and read source only to explain what was already observed — because prompt assembly is scattered across many files while the wire is single, literal ground truth.

`dsh` is the specimen because it is open, readable, and structured almost one-to-one onto the concepts we want to name. Claude Code is deliberately **not** used as a comparison baseline, since the author does not yet understand it well enough for that to mean anything; instead it is the **transfer test** — the category vocabulary built from dsh is only real if it explains a harness it wasn't derived from.

## Considered Options

- **Claude Code as baseline, compared throughout.** Rejected: you cannot diff against a baseline you don't hold. The comparison would have manufactured false confidence.
- **Pure dsh study, no comparison.** Rejected: without a second specimen there is no way to tell a category insight from a dsh implementation detail, which is the entire point of the study.
- **Source reading first, capture as confirmation.** Rejected: it inverts the evidence hierarchy. When a reading of the source and the captured bytes disagree, the bytes win, so they should be gathered first.

## Consequences

- **Build before reading.** The author starts from near-zero knowledge of the category, so the study opens by writing a ~45-line harness from scratch rather than closing with one. The toy is the primer: each shortcut it takes (truncating tool results, no permission gate, a hard step cap) is a question that a `dsh` package answers, and the list of its shortcomings is what drives the dissection order. Reading `packages/core/agent-loop` cold teaches a novice nothing; reading it after writing a loop teaches them everything.
- **No completion criterion.** The study is open-ended and depth-first. In place of "done" it uses a *surprise budget* — a thread is abandoned after two consecutive findings that don't surprise the reader — with abandoned threads filed as `needs-triage` issues so they are recorded rather than lost.
- **Claude Code is studied through local transcripts, not wire capture.** There is no Anthropic API key here; Claude Code runs on a subscription. Its own session history under `~/.claude/projects/` is already on disk and records tool invocations, permission modes, stop reasons, and hook activity — but *not* the system prompt or tool schemas. The transfer test therefore checks the model of the loop, tools, and permissions, and is silent on prompt assembly. Proxying subscription traffic was rejected as unnecessary risk for a capability transcripts already provide.
- **Analysis is published; source material is not.** `dsh`'s system prompt ships in a public MIT repo and may be quoted freely. Claude Code transcripts are personal working history — notes cite structure, counts, and tool names, never conversation content. This repo is public.
