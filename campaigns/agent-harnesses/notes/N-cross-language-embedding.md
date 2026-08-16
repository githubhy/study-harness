# N · Cross-language embedding

Thread N asked: *can a TypeScript harness be driven from Python, and what does that boundary force it to
make explicit?*

No other thread asked for this one — it is the last card on the board and nothing in fourteen threads
raised it. That is worth noting before the answer, because it turns out to be the thread that states
plainly what all the others had to infer. Read against source at `47f9438`.

## Yes, and the shape is a bundled subprocess

> Python packages for driving DeepSeek Harness as a subprocess. The client SDK communicates with the
> **bundled runtime** over newline-delimited JSON-RPC on stdio.

Two packages: `python/sdk` (the client) and `python/sdk-runtime` (*"bundled runtime binaries and default
agent configuration"*, with a `platforms.json` for per-platform builds). `pip install` gets you a Node
runtime you never see.

## The whole API is eleven operations

The client's public surface, in full:

```
start   initialize   close                      # lifecycle
session_prompt                                  # the only domain verb
request   notify   respond   respond_error      # generic JSON-RPC, both directions
next_notification   next_request                # pull
subscribe_notifications   subscribe_session_notifications
```

and the entire serialisable vocabulary is four types: `Notification`, `IncomingRequest`, `ServerInfo`,
`InitializeResponse`.

**One domain verb.** Everything a harness does, from the outside, is *prompt a session and watch what
happens* — which is exactly Thread K's enumeration of what crosses the host boundary, arrived at
independently and in a different language.

## What the boundary forces

The thread's real question. Three things, each of which my toy left implicit and each of which becomes
unavoidable once a process boundary exists.

**1 · Configuration cannot be defaulted.** *"The client selects the channel and supplies default
configuration; **the runtime itself always requires an explicit configuration**."* In-process, a missing
config is a default someone chose. Across a boundary, the runtime refuses to guess — which is the same
posture as `restrict({})` throwing (D) and a depth cap failing at mount (F), applied to the whole harness.

**2 · The harness must be able to call back.** `next_request` / `respond` / `respond_error` exist because
the boundary is **bidirectional**: the harness asks the embedder things and waits for answers.

This is the finding. In-process, Thread G noted the escalation module takes the approval channel as *"a
minimal STRUCTURAL function shape"* — a closure the tool layer passes in. **You cannot pass a closure to
another process.** So the thing that was a function pointer becomes a protocol: an incoming request the
Python side must answer, or the harness fails closed (K).

My toy's signature was `run(task) -> string`. It had no representation for the harness asking *me*
anything, because there was always a human at the terminal to notice. The RPC boundary makes that
assumption impossible to hold implicitly — and the operations that appear when you remove it are exactly
the four Thread K found ACP carrying: prompt, output, cancellation, permission.

**3 · Observation is the event stream, literally.** The notifications the Python client dispatches on are
`session.event` and `session.status`. Thread E argued that the session event log is the single authority
and everything else is a fold over it. Here that stops being an architectural claim and becomes the
public API: an embedder in another language is handed the same events every internal projection folds.

## Why nothing asked for this thread

Fourteen threads raised twenty-plus questions of each other and not one pointed here — and reading it
explains why. **The cross-language boundary introduces no new mechanism.** It is the same event log, the
same approval seam, the same explicit-configuration posture, expressed in a form where nothing can be
left to a shared address space.

Which makes it the best summary of the specimen available, and the answer to the thread's second prompt —
*what did dsh have to make explicit that you left implicit?* Not features. **The existence of a second
party.** My toy assumed one process, one human, one language, and a function that returns when it is done.
Every one of those assumptions is a thing dsh had to name, and naming them is most of what the other
fourteen threads found it doing.

## Provenance

Source read at `47f9438`. Operation list from `rg` over `python/sdk/src/deepseek_harness/client.py`;
model classes from `models.py`; quoted lines from `python/README.md`. No capture required. Logged
unsurprising: it introduced no mechanism the campaign had not already found.
