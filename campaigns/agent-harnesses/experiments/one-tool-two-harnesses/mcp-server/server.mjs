#!/usr/bin/env node
// Phase 3, side B: the same `line_count` tool as an MCP server.
//
// Zero dependencies, JSON-RPC 2.0 over newline-delimited stdio — the same
// transport dsh's own Python SDK uses (Thread N), which is a coincidence worth
// noticing: this is what a protocol boundary converges on.
//
// Deliberately faithful rather than minimal: it implements initialize,
// notifications/initialized, tools/list and tools/call, because the point of
// this file is what MCP *asks for*, and leaving a required field out would
// misrepresent that.

import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'

const PROTOCOL_VERSION = '2025-06-18'

// What MCP asks for: a name, a description, and a schema for the INPUT.
// There is no required counterpart describing the output — `outputSchema` is
// optional in the spec, and most servers omit it. See the note for what that
// costs when the tool is imported into a harness that requires one.
const TOOL = {
  name: 'line_count',
  description: 'Count the lines and bytes in a UTF-8 text file.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to a UTF-8 text file.' },
    },
    required: ['path'],
    additionalProperties: false,
  },
}

async function lineCount(path) {
  const text = await readFile(path, 'utf8')
  const bytes = Buffer.byteLength(text, 'utf8')
  return {
    path,
    bytes,
    lines: text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0),
    empty: bytes === 0,
  }
}

// The whole difference, in one function. MCP's result is content blocks: the
// tool decides how to address the model, here, inline, with no separation
// between the value it computed and the sentence it wrote about it.
async function callTool(name, args) {
  if (name !== TOOL.name) {
    return { content: [{ type: 'text', text: `unknown tool "${name}"` }], isError: true }
  }
  try {
    const v = await lineCount(args?.path)
    return {
      content: [{
        type: 'text',
        text: v.empty
          ? `${v.path} is empty (0 lines, 0 bytes).`
          : `${v.path}: ${v.lines} lines, ${v.bytes} bytes.`,
      }],
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true }
  }
}

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const reply = (id, result) => send({ jsonrpc: '2.0', id, result })

async function handle(message) {
  const { id, method, params } = message
  // A notification has no id and takes no response.
  if (id === undefined) return

  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'line-count', version: '1.0.0' },
      })
    case 'tools/list':
      return reply(id, { tools: [TOOL] })
    case 'tools/call':
      return reply(id, await callTool(params?.name, params?.arguments))
    case 'ping':
      return reply(id, {})
    default:
      return send({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `method not found: ${method}` },
      })
  }
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return
  let message
  try {
    message = JSON.parse(line)
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })
  }
  handle(message).catch((error) => {
    if (message.id !== undefined) {
      send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: String(error) } })
    }
  })
})
