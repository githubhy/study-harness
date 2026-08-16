# 01 · What my harness lacks

Phase 1's output. A ~50-line harness at `experiments/minimal-harness/harness.mjs`: a message list, two
tools, a loop, a step cap. It is the experimental control — the only harness in this campaign whose
every byte I can account for — and the table at the bottom is the thread menu, derived rather than
assumed. Written 2026-08-16.

## It works

The canonical task, through the capture proxy:

```
· write_file {"path":"fizzbuzz.js", …}
· run_command {"command":"node fizzbuzz.js"}
→ correct FizzBuzz output, three seconds
```

| Request | Messages | Bytes of context |
|---|---|---|
| 1 | 2 | 300 |
| 2 | 4 | 911 |
| 3 | 6 | 1,290 |

Three round trips: ask, act, report. Monotonic growth, no compaction — which is what a harness with no
compaction looks like, and the baseline every later measurement is read against.

Tool results come back as `role: "tool"` messages carrying `tool_call_id`. That is the whole
serialization: **a tool result is just another message.** Worth holding onto — it is the assumption
Thread D should test against a real harness, not carry over unexamined.

## Then I broke it, and one break was more interesting than expected

### Truncation — the failure was not the one I predicted

The prediction was data loss: ask for something bigger than 4,000 characters and lose the tail. What
actually happened, asking it to list every dependency in a 680 KB, 19,808-line lockfile:

```
· run_command  head -50 pnpm-lock.yaml
· run_command  sed -n '5,200p' pnpm-lock.yaml
· run_command  awk '/^importers:/,/^packages:/' …
· run_command  awk '/^importers:/{f=1} f&&/^packages:/{exit} f' … | grep -E …
· run_command  python3 -c "import re; …"
· run_command  python3 -c "import re; …"
…
stopped: hit the 10-step cap with no final answer
```

**Truncation did not just lose data. It changed the model's strategy.** Results came back clipped, so
the model started *searching* — narrower slices, then awk, then Python — and burned the step budget
doing it. The run ended at the step cap with no answer at all.

Of the nine tool results the run produced, **five were clipped at exactly 4,000 bytes**. A value that
appears five times to the byte is not data; it is a ceiling.

```chart
kind: bars
title: Every tool result the run produced
unit: bytes
highlight: clipped
highlightLabel: clipped at the 4,000-byte cap
caption: Measured from the final request, which carries each result exactly once.
bar: 1 | 25
bar: 2 | 84
bar: 3 | 1476
bar: 4 | 2365
bar: 5 · clipped | 4000
bar: 6 · clipped | 4000
bar: 7 · clipped | 4000
bar: 8 · clipped | 4000
bar: 9 · clipped | 4000
```

Context grew every step, because nothing is ever dropped:

```chart
kind: series
title: Context sent per request
x: request
caption: Bytes of the serialized message array. Three real runs, same axis.
series: toy · canonical | 300, 911, 1290
series: toy · truncation | 276, 2157, 6669, 11214, 11798, 15350, 21137, 21872, 27611, 33074
series: dsh · canonical | 9382, 632, 10624, 11068
```

The last call sent 10,416 prompt tokens to answer a question the first call could have answered with
the right 200 bytes. The `dsh` line is here for scale and is read properly in note 02 — its dip at
request 2 is a different conversation, not a context that shrank.

So **two shortcuts interacted**: the result cap (Thread C) and the step cap (Thread B). Neither failed
on its own terms. Together they turned a one-step task into a ten-step search that failed. That
interaction is the thing to look for in `dsh` — not "does it truncate" but "what does its truncation do
to the model's behaviour", which is a question I would not have thought to ask before running this.

### The missing permission layer — one step, no question asked

Five disposable `.tmp` files in a scratch directory, and:

```
· run_command {"command":"rm -f *.tmp"}
```

Gone. No confirmation, no preview, no dry run, no record of what it was about to do. One step between
a sentence in English and an irreversible `rm`. `important.txt` survived only because it did not match
the glob — nothing in the harness protected it.

This is `packages/guard`'s entire reason to exist, and the alarm is the point: the code has no gate,
and I knew that, and watching it happen is still different from knowing it.

## The table — every shortcut is a question

| What the toy does | The question it raises | Thread |
|---|---|---|
| `.slice(0, 4000)` on every tool result | What should be dropped when context fills, and how is that decided? | C |
| Runs every tool unchecked, including `rm` | Where does a permission boundary belong, and what does it gate? | D |
| Hard-coded `MAX_STEPS = 10` | What legitimately terminates a loop? | B |
| Two tools in an array literal | How does a tool get registered and described at scale? | D · A |
| One hard-coded system prompt string | What actually belongs in a system prompt? | A |
| Bare `execSync` on the host | Where should model-authored code run, and what contains it? | G |
| One loop, one context, no fan-out | When does a harness spawn another harness? | F |
| Loses everything on exit | What must be saved to resume a conversation? | I |
| No plugins, no extension points | Where should the extension boundary sit? | E · H |
| Prints to stdout | Where does the harness end and the interface begin? | K |
| Hard-codes one provider's wire format | What does model-agnosticism cost, and where does it leak? | L |
| No way to observe or interrupt it | How does anyone outside the loop see in? | J |
| Model can't track its own plan | What tools manage the model's own process? | O |

Two more, which the toy could not have suggested and the package census did: **M** (what a harness feeds
the model besides text) and **N** (driving it across a language boundary).

## One new question this run added

The toy has no notion of a *budget*, only a *count*. It stops after ten steps regardless of whether
those steps cost 300 tokens or 10,416. A harness that meters tokens could have stopped the truncation
run early and said why. That belongs to Thread J, next to `token-meter`, and sharpens its question:
not "does it count tokens" but **"can the loop stop on cost, or only on turns?"**

## A defect this phase found in the study's own instrument

The plan's mandated leak check was `rg -n 'sk-|Bearer'`. Run against the truncation capture, it
reported a leak. It was not one: the match was `sk-` inside `packages/interaction/tool-a` **`sk-`**
`user`, a path from the lockfile.

That check fires on any word containing `ask-`, `task-`, `risk-`, `desk-`. This campaign reads a
codebase full of them, and the plan calls the check non-negotiable — so it would have cried wolf
constantly until the operator learned to wave through the one check that must never be waved through.

Replaced with `tools/capture-proxy/leak-check.mjs`, which checks two independent ways: **structurally**,
that every sensitive header reads `<redacted>`, catching a redaction bug even for a credential format
nobody anticipated; and **by shape**, hunting key-like strings anywhere in the file, including bodies
where a model may echo a secret the proxy never saw as a header. Verified to catch a planted key three
ways and to stay silent on `tool-ask-user`.

## Next

Phase 2, Task 2.0: capture `dsh` on the same canonical task and write down **only what was observable**,
before reading any source. `DSH_CMD` and the base-URL override are both recorded in `00-orientation.md`.
