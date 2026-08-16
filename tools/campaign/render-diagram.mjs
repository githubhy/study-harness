// Block and dataflow diagrams for campaign notes.
//
// One primitive: a chain of stages, arrows labelled with what actually moves,
// an optional return edge, and optional marks pinned under a stage. That covers
// the three shapes these notes need — a loop, a pipeline, and a cycle — without
// a layout engine or hand-tuned coordinates that rot.
//
// Structure is drawn in currentColor so it inherits the page's foreground in
// both themes; marks use the specimen accent, which is the one thing on the
// figure carrying an argument rather than a mechanism.

import { esc, attr } from './html.mjs'

const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const ACCENT = 'var(--specimen)'

/** Wrap a label onto at most two lines, breaking on spaces. */
const wrap = (text, width = 16) => {
  const words = String(text).split(/\s+/)
  const lines = ['']
  for (const word of words) {
    const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word
    if (candidate.length <= width || !lines[lines.length - 1]) lines[lines.length - 1] = candidate
    else lines.push(word)
  }
  return lines.slice(0, 2)
}

export function parseDiagramSpec(body) {
  const spec = { nodes: [], edges: [], marks: [] }
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const at = line.indexOf(':')
    if (at === -1) continue
    const key = line.slice(0, at).trim()
    const value = line.slice(at + 1).trim()
    if (key === 'node') {
      const [label, sub] = value.split('|').map((s) => s.trim())
      spec.nodes.push({ label, sub })
    } else if (key === 'edge') {
      spec.edges.push(value)
    } else if (key === 'mark') {
      const [index, text] = value.split('|').map((s) => s.trim())
      spec.marks.push({ index: Number(index) - 1, text })
    } else {
      spec[key] = value
    }
  }
  if (spec.nodes.length === 0) throw new Error('diagram: no nodes')
  return spec
}

/**
 * A stable id per diagram. Two diagrams on one page both defining `dg-arrow`
 * is a duplicate id — caught by the HTML property checks, which is what they
 * are for. Derived from the body so it stays identical across rebuilds; a
 * counter would change whenever a diagram was added above another and show up
 * as spurious drift.
 */
const idFor = (body) => {
  let hash = 0
  for (let i = 0; i < body.length; i++) hash = (Math.imul(31, hash) + body.charCodeAt(i)) | 0
  return `dg-${(hash >>> 0).toString(36)}`
}

export function renderDiagram(body) {
  const spec = parseDiagramSpec(body)
  const n = spec.nodes.length
  const arrowId = idFor(body)

  const BOX_W = 116, BOX_H = 52, GAP = 62
  const PAD = 12
  const hasBack = Boolean(spec.back)
  const markRows = Math.max(0, ...spec.marks.map((m) => 1))
  const TOP = 22                       // room for edge labels
  const BACK_H = hasBack ? 46 : 0
  const MARK_H = markRows ? 34 : 0
  const W = PAD * 2 + n * BOX_W + (n - 1) * GAP
  const H = TOP + BOX_H + MARK_H + BACK_H + PAD

  const xOf = (i) => PAD + i * (BOX_W + GAP)
  const midY = TOP + BOX_H / 2

  const boxes = spec.nodes.map((node, i) => {
    const x = xOf(i)
    const lines = wrap(node.label)
    const labelY = node.sub ? TOP + 21 : TOP + (lines.length === 1 ? 30 : 23)
    const text = lines.map((line, k) =>
      `<text x="${x + BOX_W / 2}" y="${labelY + k * 13}" text-anchor="middle" font-size="12"`
      + ` fill="currentColor" font-family="${FONT}">${esc(line)}</text>`).join('')
    const sub = node.sub
      ? `<text x="${x + BOX_W / 2}" y="${TOP + 39}" text-anchor="middle" font-size="10"`
        + ` fill="currentColor" opacity=".62" font-family="${FONT}">${esc(node.sub)}</text>`
      : ''
    return `<rect x="${x}" y="${TOP}" width="${BOX_W}" height="${BOX_H}" rx="3" fill="none"`
      + ` stroke="currentColor" stroke-width="1.25"/>${text}${sub}`
  }).join('')

  const arrows = spec.nodes.slice(0, -1).map((_, i) => {
    const from = xOf(i) + BOX_W
    const to = xOf(i + 1)
    const label = spec.edges[i]
    return `<line x1="${from + 4}" y1="${midY}" x2="${to - 6}" y2="${midY}" stroke="currentColor"`
      + ` stroke-width="1.25" marker-end="url(#${arrowId})"/>`
      + (label
        ? `<text x="${(from + to) / 2}" y="${TOP - 7}" text-anchor="middle" font-size="10"`
          + ` fill="currentColor" opacity=".62" font-family="${FONT}">${esc(label)}</text>`
        : '')
  }).join('')

  // The return edge is the whole point of a loop diagram: it says the thing
  // repeats, and its label says what that repetition costs.
  const back = hasBack
    ? `<path d="M${xOf(n - 1) + BOX_W / 2},${TOP + BOX_H} V${TOP + BOX_H + MARK_H + 26}`
      + ` H${xOf(0) + BOX_W / 2} V${TOP + BOX_H + 4}" fill="none" stroke="currentColor"`
      + ` stroke-width="1.25" stroke-dasharray="4 4" marker-end="url(#${arrowId})"/>`
      + `<text x="${W / 2}" y="${TOP + BOX_H + MARK_H + 40}" text-anchor="middle" font-size="10"`
      + ` fill="currentColor" opacity=".62" font-family="${FONT}">${esc(spec.back)}</text>`
    : ''

  const marks = spec.marks.map((mark) => {
    const x = xOf(mark.index) + BOX_W / 2
    return `<line x1="${x}" y1="${TOP + BOX_H}" x2="${x}" y2="${TOP + BOX_H + 10}"`
      + ` stroke="${ACCENT}" stroke-width="1.25"/>`
      + `<text x="${x}" y="${TOP + BOX_H + 23}" text-anchor="middle" font-size="10"`
      + ` fill="${ACCENT}" font-family="${FONT}">${esc(mark.text)}</text>`
  }).join('')

  const claim = spec.caption ?? spec.title ?? 'diagram'
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(claim)}">`
    + `<defs><marker id="${arrowId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"`
    + ` markerHeight="6" orient="auto-start-reverse">`
    + `<path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`
    + `<g style="color:var(--ink)">${arrows}${boxes}${marks}${back}</g></svg>`

  return `<figure class="viz">`
    + (spec.title ? `<p class="viz-t">${esc(spec.title)}</p>` : '')
    + svg
    + (spec.caption ? `<figcaption>${esc(spec.caption)}</figcaption>` : '')
    + `</figure>`
}
