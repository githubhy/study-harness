# H · Interop · MCP & ACP

Thread H asked what crosses the boundary to other systems. It carried F's question: a foreign child runs
on its own policy engine, so what does dsh actually *get back* from a Claude Code child — text, or
structured events it can audit? Read against source at `47f9438`.

The answer to that is short, and the pattern behind it is the thread's real finding.

## Interop is normalization

Every foreign protocol dsh speaks is translated into a dsh primitive at the edge, so that everything
downstream works unchanged. Three instances, found across three threads:

| Foreign thing | Normalized to | Found in |
|---|---|---|
| Claude Code / Codex hook configs | listeners on cordis seams (`tools/pre-execute`, `agent/turn-stopping`, …) | J |
| Claude Code SDK / `codex app-server` children | one `SubagentResult` | F |
| An external MCP server's tools | ordinary registrations on `ctx.tools` | here |

`mcp-client` (929 lines) *"connects to an external MCP server and registers its tools on `ctx.tools` under
server-qualified public names (`mcp__<serverName>__<rawName>`)"*. That is the whole strategy in one line.
An MCP tool is **not a category** in dsh. It is a tool. Which means, without a line of MCP-aware code
anywhere else, it inherits everything Thread D found:

- it passes the same three-stage gate — `restrict`, the `tools/pre-execute` waterfall, then monotonic guards
- it must declare an `output` with a schema, and its result reaches the model through `render()`
- it can be restricted per scope, so a delegated child can be given a narrower set of MCP tools than its
  parent (Thread F)
- it appears in Code Mode as a callable binding like any other

The namespacing is deliberate rather than cosmetic: *"identical `serverName` reproduces identical public
tool names"*, and disposal *"releases the `serverName` namespace reservation."* A tool's public name is
stable across a hot reload, which matters because the name is what appears in a durable log that will be
folded again later (Thread E).

## Direction matters, and it is not symmetric

| Protocol | dsh's role |
|---|---|
| MCP | **client only** — it consumes external tools; there is no MCP server |
| ACP | **server** — *"Automation-only Agent Client Protocol server over JSON-RPC stdio"* (Thread K) |
| Claude Code / Codex | **host** — it spawns their real runtimes as children (Thread F) |

So dsh consumes tools, exposes itself for automation, and drives competitors. It does not offer itself as
an MCP tool provider to someone else's agent.

## What comes back from a foreign child

F's question. `SubagentResult` has exactly three fields:

```
output: ContentBlock[]     // the child's last non-empty assistant message
structured?: unknown       // present only if an outputSchema was requested and satisfied
stopReason: SubagentStopReason
```

*"The child's final assistant output is the content of its last non-empty assistant message. Empty-content
messages, including usage-only messages, are skipped. Without a non-empty message, the output is its
accumulated assistant text stream, or `[]` when the child produced neither."* And a non-`completed`
`stopReason` means the output may be partial — stated rather than left to be discovered.

**So: text, plus an optional schema-validated value, plus why it stopped.** A Claude Code child's internal
steps, its tool calls, its own permission decisions and its token usage never enter dsh's log. They are not
lost because of an oversight; there is no representation for them, because normalization is the whole
strategy and those things do not normalize.

### The delegation boundary is also the observability boundary

This completes a line that runs through three threads. Thread J found observation inside dsh is total —
every consumer folds the same event log. Thread F found the *policy* guarantees stop at the process
boundary, since you cannot seed a `sandbox/mode` event onto a session log a foreign process does not have.
Thread H finds *observation* stops in the same place and for the same reason.

An in-process child is fully legible: its session log is dsh's own, and every projection reads it. An
out-of-process child is a black box that returns three fields. Both are called "subagent" through one
seam, and that seam is honest about the difference in the one place it can be — `maxDepth:
'provider-managed'`, the admission that the child's recursion budget is not dsh's to enforce (Thread F).

That is the cost of normalization, and it is worth naming plainly: **a protocol boundary that makes foreign
things usable also makes them opaque.** The same translation that lets an MCP tool inherit the entire
permission system is what stops a Claude Code child's decisions from ever being auditable.

## Questions this opens

None. F's question is answered and this thread raised nothing it could not settle from source — which is
itself the signal that the surprise budget is close to spent here.

## Provenance

Source read at `47f9438`. `SubagentResult` from `subagent/src/types.ts:219`; the MCP naming rule from
`mcp-client/src/index.ts`. No capture required.
