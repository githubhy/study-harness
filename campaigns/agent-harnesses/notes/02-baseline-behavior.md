# 02 · Baseline behaviour

What `dsh` did on the canonical task, recorded **before reading any source**. Only what was observable
from the terminal and the capture. Where something suggests an explanation, it is written as a question,
because a guess recorded as a fact is worse than no note. Thread B reconciles every line of this against
the code later; that only means anything if this was written blind.

Run 2026-08-16, specimen at `47f9438`, through the capture proxy.
Task, verbatim: *"Create a file called fizzbuzz.js that prints FizzBuzz for 1..20, then run it with node
and show me the output."*

## The shape of the run

Exit 0 in **5 seconds**. It created `fizzbuzz.js`, ran it, and printed the output. Correct answer.

**Four HTTP round trips — but only three are the agent loop.**

| Request | Messages | Bytes | Tools offered | `max_tokens` | `thinking` |
|---|---|---|---|---|---|
| 1 | 4 | 9,382 | 25 | — | enabled, `reasoning_effort: high` |
| **2** | **2** | **632** | **0** | **64** | **disabled** |
| 3 | 6 | 10,624 | 25 | — | enabled, `reasoning_effort: high` |
| 4 | 8 | 11,068 | 25 | — | enabled, `reasoning_effort: high` |

Request 2 is a different conversation. Its system message asks for *"a concise title for an AI
coding-assistant session"* and its user message supplies the human messages as JSON. No tools, 64 tokens,
thinking off. It runs **in the middle of the task**, between the first and second loop steps.

So: **one task produced two conversations against the same model with different configurations.** My toy
made three calls and all three were the loop. Counting "round trips" as one number would have been wrong
here, and I would not have known unless I looked at the bodies.

*Question for later:* is the title call blocking? It sits between loop steps in sequence, but the capture
records completions, so ordering here is not proof of blocking.

## What it sends that my toy does not

**Request parameters:** `stream`, `stream_options`, `thinking`, `reasoning_effort`, `max_tokens`. Every
call streams; my toy did not. Loop calls set `thinking: {"type":"enabled"}` and `reasoning_effort: "high"`.
The title call disables both — **the harness varies inference settings per call, not per session.**

**25 tools**, against my two:

```
bash  create_goal  edit  exit_plan_mode  get_goal  glob  grep  interrupt_agent
job_kill  job_list  job_output  list_agents  ralph  read  read_image  send_message
skill  str_replace_editor  subagent  subagent_fork  todo_write  update_goal
web_search  workflow  write
```

Reading only the names: file access (`read`, `write`, `edit`, `str_replace_editor`, `glob`, `grep`),
shell (`bash`), and then whole categories my toy has no concept of — goals (`create_goal`, `get_goal`,
`update_goal`), background jobs (`job_kill`, `job_list`, `job_output`), other agents (`subagent`,
`subagent_fork`, `list_agents`, `send_message`, `interrupt_agent`), and process tooling (`todo_write`,
`skill`, `workflow`, `exit_plan_mode`). One name, `ralph`, I cannot guess from its name at all.

**A 4,113-byte system prompt**, against my 129. It opens *"You are an AI agent powered by DeepSeek
Harness."*

## The user turn is three messages, not one

Request 1 carries `system`, then **three** `user` messages before any assistant reply:

| # | Bytes | What it is |
|---|---|---|
| 1 | 110 | The task, verbatim as typed |
| 2 | 562 | *"Current runtime context. This snapshot supersedes earlier runtime-context snapshots."* |
| 3 | 4,423 | A `<system-reminder>` block describing available skills |

```chart
kind: stack
title: What the first request is actually made of
unit: bytes
caption: The four messages of request 1, to scale. The task is the sliver on the right.
part: system prompt | @dsh-canonical.firstRequestBytes.0
part: skills reminder | @dsh-canonical.firstRequestBytes.3
part: runtime context | @dsh-canonical.firstRequestBytes.2
part: the task itself | @dsh-canonical.firstRequestBytes.1
```

**The task is 1.2% of the request.** Ninety-nine percent of what the model reads before its first token
was written by the harness, not by me.

Two things stand out. The injected context arrives as **`user` messages, not `system`** — so from the
model's side it is indistinguishable from something the human said. And message 2 announces that it
*supersedes* earlier snapshots, which only makes sense if these are re-injected as the conversation grows.

*Question for later:* if a superseding snapshot is added each turn, is the superseded one removed from the
history, or does it accumulate? That is a compaction question and I cannot answer it from a 4-request run.

## The loop, as it appeared

Tool calls, in order: **`write`**, then **`bash`**. Two tools for a task my toy also did in two.

Interleaved, the assistant narrates before acting:

```
[assistant] I'll create the fizzbuzz.js file, then run it with node.
[tool]      <path>…/fizzbuzz.js
[assistant] Now let me run it with node:
[tool]      1 2 Fizz 4 Buzz … Buzz
```

**It verified its own work.** It did not write the file and report success; it ran the file and the tool
result contains the real interpreter output, which is what it then quoted to me. My toy did this too, but
only because the task said to — worth checking whether dsh does it when unasked.

The `write` result is not free text: it came back as `<path>…`, some structured wrapper. My toy returned
`wrote fizzbuzz.js`, a sentence.

## What it did not do

- **It never asked permission.** It wrote a file and executed a shell command in a directory it had never
  seen, with no prompt, no preview, no confirmation. Same as my toy. Whether that is the default posture
  or a property of this profile, I cannot tell from one run.
- **It displayed nothing between steps.** stderr was empty; stdout carried only the final message. Five
  seconds of silence, then the answer.
- **It never retried, and nothing failed.** No non-200 in the capture.

## Numbers to reconcile later

| | toy | dsh |
|---|---|---|
| Round trips for the task | 3 | 3 loop + 1 auxiliary |
| Tools offered | 2 | 25 |
| System prompt | 129 B | 4,113 B |
| First request | 300 B | 9,382 B |
| Last request | 1,290 B | 11,068 B |
| Growth across the run | ×4.3 | ×1.18 |
| Streaming | no | yes |
| Verified its own work | yes (told to) | yes |
| Asked permission | no | no |

The growth ratio is the one I did not expect. dsh starts **31× larger** and grows **hardly at all** across
the run, where my toy starts tiny and quadruples. Most of dsh's context is fixed overhead — prompt, tool
schemas, injected reminders — and the task itself barely moves it. On a three-step task that is free. The
open question is what happens on a thirty-step one, which this run cannot answer.

## Provenance

Written from the terminal output and `captures/session-dsh-canonical.jsonl` alone, with no source
reading between the run and this file. The blind-observation check and the leak check both live in the
roadmap's Phase 2 card and were run against this note and every capture; deliberately not quoted here,
because a note that contains the pattern its own check forbids fails that check on itself.
