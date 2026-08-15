# Study agent harnesses outside-in, with dsh as specimen and Claude Code as transfer test

The subject of this repo is agent harnesses as a category, not the DeepSeek Harness in particular. We study outside-in: capture the wire traffic a harness sends to the model API first, and read source only to explain what was already observed — because prompt assembly is scattered across many files while the wire is single, literal ground truth.

`dsh` is the specimen because it is open, readable, and structured almost one-to-one onto the concepts we want to name. Claude Code is deliberately **not** used as a comparison baseline, since the author does not yet understand it well enough for that to mean anything; instead it is the **transfer test** — the category vocabulary built from dsh is only real if it explains a harness it wasn't derived from.

## Considered Options

- **Claude Code as baseline, compared throughout.** Rejected: you cannot diff against a baseline you don't hold. The comparison would have manufactured false confidence.
- **Pure dsh study, no comparison.** Rejected: without a second specimen there is no way to tell a category insight from a dsh implementation detail, which is the entire point of the study.
- **Source reading first, capture as confirmation.** Rejected: it inverts the evidence hierarchy. When a reading of the source and the captured bytes disagree, the bytes win, so they should be gathered first.

## Consequences

- **No completion criterion.** The study is open-ended and depth-first. In place of "done" it uses a *surprise budget* — a thread is abandoned after two consecutive findings that don't surprise the reader — with abandoned threads filed as `needs-triage` issues so they are recorded rather than lost.
- **Capture and analysis are decoupled in time.** Claude Code traffic is captured early (it costs nothing and the key is already available) but analysed late, after the dsh-derived vocabulary exists. Collecting data early does not contaminate a vocabulary built later.
- **Captured prompts are analysed, not published.** `dsh`'s system prompt ships in a public MIT repo and may be quoted freely. Claude Code's has not been published by Anthropic, so notes describe its structure and behaviour without committing verbatim text. This repo is public.
