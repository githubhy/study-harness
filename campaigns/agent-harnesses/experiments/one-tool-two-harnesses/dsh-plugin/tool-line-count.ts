/**
 * Phase 3, side A: `line_count` as a dsh plugin.
 *
 * The same trivial tool is implemented twice — here against dsh's tool registry,
 * and in ../mcp-server against MCP. Neither implementation is interesting. The
 * diff between what each protocol *demands* is the finding, and it is written up
 * in notes/03-one-tool-two-harnesses.md.
 *
 * Modelled on packages/interaction/tool-ask-user (dsh @ 47f9438), the smallest
 * real tool in the specimen, so the shape here is the shipped shape rather than
 * one inferred from types.
 *
 * @module line-count-dsh
 */

import { readFile } from 'node:fs/promises'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'

/** The canonical value this tool returns. Declared once, below, and enforced. */
interface LineCount {
  path: string
  lines: number
  bytes: number
  empty: boolean
}

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'line_count',
    description: 'Count the lines and bytes in a UTF-8 text file.',

    // 1 · What the tool ACCEPTS. MCP has this too, as `inputSchema` — but not in
    //     this shape. dsh uses its own "value schema DSL", not raw JSON Schema:
    //     `required` is a BOOLEAN on each property, never a sibling array, and
    //     `parameters` is the property map directly with no wrapping
    //     `type: 'object'`. Both mistakes are rejected at registration with
    //     UNSUPPORTED_SCHEMA naming the exact violation — which is how the first
    //     two drafts of this file died. See the note: I got this wrong twice
    //     from reading, and right once from running.
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to a UTF-8 text file.',
      },
    },

    // 2 · What the tool RETURNS, as data. MCP has no equivalent of this at all
    //     before its optional `outputSchema`, and dsh makes it mandatory.
    output: {
      // Same DSL as `parameters` above — `required` per property, not an array —
      // but a FULL schema node here rather than a bare property map.
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          lines: { type: 'number', required: true },
          bytes: { type: 'number', required: true },
          empty: { type: 'boolean', required: true },
        },
      },

      // 3 · How that data becomes text for a model. A PURE projection — it may
      //     not read the filesystem, call a model, or consult anything but its
      //     two arguments, which is what makes a recorded result replayable.
      render: (_args, value) => {
        const v = value as unknown as LineCount
        return [{
          type: 'text',
          text: v.empty
            ? `${v.path} is empty (0 lines, 0 bytes).`
            : `${v.path}: ${v.lines} lines, ${v.bytes} bytes.`,
        }]
      },
    },

    // 4 · The body returns the canonical value and nothing else. It never
    //     decides how to address the model — that is render's job, above.
    async execute(args, exec): Promise<LineCount> {
      const { path } = args as { path: string }
      const text = await readFile(path, 'utf8')
      exec.signal.throwIfAborted()
      const bytes = Buffer.byteLength(text, 'utf8')
      return {
        path,
        bytes,
        lines: text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0),
        empty: bytes === 0,
      }
    },
  }))
}
