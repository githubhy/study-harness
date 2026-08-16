# 03 · One tool, two harnesses

Phase 3. The same trivial tool — `line_count`, which reports the lines and bytes in a file — built twice:
once as a dsh plugin, once as an MCP server. Neither implementation is interesting. **The diff between
what each protocol demands is the finding.**

Both were run, not just written. `experiments/one-tool-two-harnesses/`.

## What each protocol asks for

| | dsh | MCP |
|---|---|---|
| name, description | ✓ | ✓ |
| input schema | `parameters` — value-schema DSL, property map | `inputSchema` — raw JSON Schema |
| **output schema** | **mandatory** `output.schema` | optional `outputSchema` |
| model-facing text | `render(args, value)`, a **pure projection** | the tool returns `content` blocks itself |
| what the body returns | a canonical JSON value, nothing else | content blocks |
| concurrency | `isConcurrencySafe?` | — |
| timeout | `timeoutMs?` | — |
| presentation | `presentCall?`, `presentResult?` | — |

The rows below the line are Thread D's finding restated: the wire schema is the smallest part of what a
harness needs to know. But the load-bearing difference is the third and fourth rows.

## The one difference everything else follows from

```diagram
kind: chain
title: A dsh tool result is projected; an MCP tool result is written
caption: dsh separates what the tool computed from how the model is told about it. MCP has no equivalent of the two middle stages — the tool body returns content blocks, so it decides how to address the model inline. Every consequence below follows from those two stages existing.
node: execute() | returns a value
node: output.schema | validated
node: render() | pure projection
node: content blocks | what the model reads
edge: canonical JSON
edge: on success
edge: args + value
mark: 2 | MCP: optional
mark: 3 | MCP has no such stage
```

An MCP tool writes its own sentence, in the same function that did the work:

```js
// mcp-server/server.mjs — the whole difference, in one return
return { content: [{ type: 'text', text: `${v.path}: ${v.lines} lines, ${v.bytes} bytes.` }] }
```

A dsh tool returns `{ path, lines, bytes, empty }` and declares, separately, a pure function that turns
that into the same sentence. Three things follow, and Threads D and H found all three without knowing they
had one cause:

- **Results replay identically.** `render` is pure, so a recorded value renders the same text forever.
- **Code Mode can exist.** A program calling the tool takes `value`; the model takes `render(value)`. One
  tool serves both because the two were never fused.
- **Note 02's observation.** dsh's `write` result came back as a structured `<path>…` wrapper where my toy
  returned the sentence `wrote fizzbuzz.js`. That wrapper is `render`.

## Translation is lossy in exactly one direction

A dsh tool can be exposed over MCP trivially: run `render` and put the blocks in `content`. Nothing is
lost, because MCP asks for less.

Going the other way cannot work, and `mcp-client` shows exactly what it does instead
(`packages/mcp/mcp-client/src/tools.ts:200-215`). Since dsh requires an `output.schema` and an imported
MCP tool has no domain value to declare, it synthesises one **describing MCP's envelope**:

```
schema: { properties: { content: {type:'array', items:{}},
                        structuredContent: <the MCP outputSchema, or {}> } }
render: (_args, value) => [{ type: 'text', text: extractText(value.content) }]
```

So the canonical value of an imported MCP tool is *"an MCP response"*. The contract survives as a shape and
loses its content: a native tool declares what it **means**, an imported one declares only that it
returned. The degradation is proportional — an MCP server that does declare an `outputSchema` gets it
threaded into `structuredContent` — so the loss is the MCP ecosystem's optionality, not dsh's bridge.

One blemish. `supportedOutputSchema` wraps the check in `try { … } catch { return undefined }`, so an MCP
tool whose output schema uses vocabulary dsh does not support is **silently** widened to "anything". Every
comparable failure in this specimen is loud — `restrict()` throws on unknown tool names, a duplicate
registration throws, a depth cap without provider support fails at mount. This one is a swallowed
exception, and it is the only silent widening the campaign has found.

## Two things that only running it revealed

**1 · I got dsh's schema dialect wrong twice.** The first draft wrote `parameters` as raw JSON Schema and
was rejected:

```
code: 'UNSUPPORTED_SCHEMA', violations: [ 'parameters.type must be a value schema object' ]
```

The second fixed `parameters` but left `required: ['path', …]` in `output.schema`, and was rejected again:

```
violations: [ 'schema.required is not supported by the value schema DSL' ]
```

The actual contract is one DSL throughout — `required` is a **boolean on each property**, never an array —
with `parameters` as a bare property map and `output.schema` as a full schema node. I had written a note
paragraph asserting "two different schema dialects" after the first failure; it was wrong, and the second
failure caught it before it shipped.

That is the note-00 `tui` lesson arriving with a better outcome. Reading produced a plausible wrong answer
twice; **executing produced the right one and refused the wrong ones with the exact violation named.** A
harness that validates tool definitions at registration rather than at first call is doing its author a
service, and this is what that service feels like.

**2 · My MCP server returns responses out of order.** Running four requests through it:

```
id 1 → initialize     id 2 → tools/list
id 4 → unknown tool          ← settled first, because it does no I/O
id 3 → line_count            ← settled second, because it reads a file
```

Nothing is broken — JSON-RPC matches on `id`. But it is a live demonstration of the problem Thread B found
dsh's scheduler solving. `runGroup` in `tool-calls.ts` advances a `committed` cursor *"only across
contiguous model-order slots"*, holding a finished result until every earlier call in the batch has
settled, so results reach the model in the order the model asked for them. My hundred-line server has no
such machinery and immediately exhibits why one is needed.

I did not plan that observation. It is the argument for building the thing rather than reasoning about it.

## Provenance

`mcp-server/server.mjs` executed against a real stdio client; transcript in this note. The dsh definition
was validated by the specimen's own `defineTool` inside the pinned checkout — three attempts, two
rejections quoted verbatim — with the probe file removed and `git status` confirmed clean afterwards, so
the specimen is untouched. `createOutput` and `supportedOutputSchema` read from
`packages/mcp/mcp-client/src/tools.ts` at `47f9438`.
