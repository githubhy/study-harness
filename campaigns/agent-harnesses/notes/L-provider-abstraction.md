# L · Provider abstraction

Thread L was raised by my toy's shortcut: one hardcoded wire format, one endpoint, one model. The question
is what the seam looks like when it is real. Read against source at `47f9438`.

The answer is that there is no single seam. There are three, and they are separable — which is why Thread
B kept finding holes shaped like plugins that were not there.

## Three seams, not one adapter interface

| Package | Lines | What it owns |
|---|---|---|
| `llm` | 2,625 | *"adapter registry with a **waterfall-interceptable** streaming call API"* |
| `llm-pi-ai` | 2,706 | a generic adapter owning *"a dict of provider routes"* |
| `llm-deepseek` | 1,216 | the DeepSeek adapter (note 00 traced `DEEPSEEK_BASE_URL` here) |
| `llm-retry` | 494 | retry policy on the loop's request-recovery extension point |

**1 · The adapter registry** is the obvious seam — `LlmAdapter` for provider backends, `BlockAssembler` for
chunk assembly. Thread B watched the loop use it: `this.loopCtx.llm.stream(request)`, one `for await` over
chunks, no non-streaming path anywhere.

**2 · The call itself is interceptable.** *"waterfall-interceptable streaming call API"* — the request goes
through `agent/request` before it is sent, and Thread B's contract-regression list included *"the
`agent/request` waterfall can supply the model for a model-less agent."* So an agent can be created with no
model at all and have one supplied per-request by a plugin. The provider is not a property of the agent; it
is a decision made at each call, by whoever is listening.

**3 · Retry is a separate plugin, and this is exactly what Thread B predicted.** B found the loop's inner
`while (true)` spins only when a plugin answers `agent/request-error` with `{kind:'retry'}`, that the
default resolver returns `undefined`, and concluded: *"retry is a plugin, and the loop's only contribution
is a hook to hang one on."* `llm-retry` is that plugin — *"provider-routed model-request retry policy on
the agent loop's request recovery extension point."*

Its one interesting property: *"Each scheduled retry is **durable before its cancellable wait**."* The
decision to retry, and when, is written to the log *before* the backoff sleeps. A crash during a two-minute
backoff resumes knowing a retry was owed — which is Thread I's discipline applied to a delay.

## The routing layer is the biggest package here

`llm-pi-ai` (2,706 lines — larger than the DeepSeek adapter and the core service's registry alike) is worth
reading as a statement of intent:

> One plugin instance owns a dict of provider routes; a route naming an installed pi-ai provider inherits
> that provider's endpoint, protocol, and model catalog as defaults, and a route pi-ai does not ship is
> declared outright.

So the specimen is not a DeepSeek client with an abstraction bolted on. `llm-deepseek` is one adapter
beside a generic router that inherits endpoints, **protocols** and model catalogues from an upstream
provider registry. Protocol is in that list — the wire format is a route property, not a global.

And configuration is live:

> Profile facts resolve per request over the optional `llm-pi-ai` user-settings section and the optional
> credential seam, so **a changed key, endpoint, model, or knob reaches the next request without a
> restart**; a changed *route set* re-registers the same adapter instance in place.

Resolving per request rather than at mount is what makes that possible, and it is the same shape as
`sandbox-policy` resolving per call (Thread G) and the system prompt assembling per step (Thread A). This
harness resolves almost nothing at startup.

## What my toy actually got wrong

Not "it only supported one provider" — that is a scope decision and a fine one. The mistake was
**collapsing three independent decisions into one constant**: which endpoint, which wire format, and what
to do when the call fails. My toy's `fetch` call answered all three at once and none of them could be
changed without editing it.

Note 02 measured a consequence I did not connect at the time. dsh's calls set `stream`, `stream_options`,
`thinking`, `reasoning_effort` and `max_tokens`, and the title call disabled thinking while the loop calls
enabled it — *"the harness varies inference settings per call, not per session."* That is only possible
because the request is assembled at the call and interceptable on the way out. A hardcoded `fetch` cannot
vary per call, because there is no per-call decision point to vary at.

## Questions this opens

None. This thread's question was raised by my own shortcut rather than by another thread, and the source
answers it completely. Logged as unsurprising: Thread B predicted the retry seam precisely, and everything
else here is the pattern this campaign has already established — resolve late, make the seam a waterfall,
keep the policy in a plugin.

## Provenance

Source read at `47f9438`. Line counts from `wc -l` over each `src`; quoted docstrings from
`packages/llm/{llm,llm-pi-ai,llm-retry}`. The per-call inference settings are from the committed
`measurements.json`, derived from the Task 2.0 capture. No new capture required.
