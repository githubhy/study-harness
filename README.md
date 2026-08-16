# study-harness

A study of **agent harnesses as a category** — the layer that assembles context, calls a model,
parses tool calls, executes them, and appends the results.

The specimen is [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
pinned at `47f9438`. The method opens by writing a ~45-line harness from scratch, so that reading a
real one has something to be wrong about, and closes by testing the resulting model against a harness
it was never derived from.

**📋 [Read the study](https://githubhy.github.io/study-harness/)** — board, roadmap, worklog, and 22 notes.

## The finding

> **An agent harness is an event-sourced system whose log has to double as a provider-valid
> transcript.**

That one constraint — the source of truth must also be legal to send to a model — separates this
design from ordinary event sourcing, and nearly everything else is downstream of it. A transcript
holding a tool call with no matching result is not untidy; it is rejected on the wire. So the balance
property is enforced three times over, by parties that do not trust each other: the loop's `finally`
blocks produce it, the token meter throws when it is violated, and crash repair manufactures it after
the fact.

A second result, on what stops a run: **nothing internal does.** There is no step cap anywhere in the
specimen. Every ceiling it defines bounds one tool call, one model call, one step, or one payload —
not one bounds a run. Termination is semantic instead, a closed set of six recorded reasons, one of
which is never emitted at runtime at all.

[**06 · What a harness is**](campaigns/agent-harnesses/notes/06-what-a-harness-is.md) is the front
door to the argument. Everything in it is argued in a specific note, cited to a line.

## Where to start

| If you want | Read |
|---|---|
| The conclusion | [06 · What a harness is](campaigns/agent-harnesses/notes/06-what-a-harness-is.md) |
| The plan and the fifteen threads | [roadmap.html](https://githubhy.github.io/study-harness/campaigns/agent-harnesses/roadmap.html) |
| What was actually found, thread by thread | [worklog.html](https://githubhy.github.io/study-harness/campaigns/agent-harnesses/worklog.html) |
| The vocabulary | [CONTEXT.md](campaigns/agent-harnesses/CONTEXT.md) · [shared terms](CONTEXT-MAP.md) |
| Why the method is shaped this way | [docs/adr/](docs/adr/) |
| The layout of the workspace | [CONTEXT-MAP.md](CONTEXT-MAP.md) |

The `.html` pages are generated and only render on the published site; the `.md` notes render here on
GitHub.

## How it was done

Six phases, fifteen threads, and 46 logged findings across 22 notes, with ten captures taken through a
redacting proxy behind the numbers.

- **Build before reading.** Phase 1 writes a control harness from scratch. Reading
  `packages/core/agent-loop` cold teaches a novice nothing; reading it after writing a loop teaches
  them everything, and the toy's failures are what the thread menu is derived from.
- **The wire beats the source.** Where reading the code and reading the captured request disagree,
  the request wins. Ten captures sit behind the numbers in the notes.
- **A surprise budget.** Two consecutive unsurprising findings and a thread is declared dry and
  dropped. 34 of 46 findings were surprising; no thread went dry.
- **Predict, then look.** The transfer test commits its predictions to a git commit *before* opening
  the transfer specimen. A prediction made after looking tests nothing.

The method's most repeated result was about the method: **seven claims reached by reading were wrong,
and every one was caught by running something** — never by re-reading. An invented CLI profile, a
tool-schema dialect wrong twice, a measurement script that silently never counted tool schemas, and a
leak checker that scanned nothing and reported "clean".

## Layout

    campaigns/<name>/     one campaign per subject — glossary, plan, roadmap, notes, experiments
    campaigns/board.json  repo-level board data
    docs/adr/             the method: decisions that outlive any one campaign
    tools/                shared instruments — the capture proxy, the page generator

Start at [`CONTEXT-MAP.md`](CONTEXT-MAP.md) for the full map.

## Building the pages

`campaigns/index.html`, each campaign's `roadmap.html` and `worklog.html`, and every `notes/*.html`
are generated from `campaign.json` and `board.json`. Never hand-edit them.

```sh
node tools/build-campaign.mjs --all           # write every page
node tools/build-campaign.mjs --all --check   # exit 1 if a page has drifted from its data
node --test tools/campaign/*.test.mjs         # 190 tests, zero dependencies
```

## A note on what is not here

`captures/` is gitignored in every campaign, and this repo is public. Captures are recorded through a
proxy that redacts credentials *before* writing to disk, and the committed `measurements.json` carries
the derived numbers so the notes can cite them without the transcripts.

The transfer specimen is Claude Code, studied through local transcripts of the author's own sessions.
Those are personal working history: the study cites their structure, counts, and tool names, and never
their content. The specimen's own prompt ships in a public MIT-licensed repo and is quoted freely.
