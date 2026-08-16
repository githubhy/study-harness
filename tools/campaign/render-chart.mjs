// Charts for campaign notes, rendered inline from measured data.
//
// The data lives in the note beside the prose that interprets it, because that
// is where the evidence is; this module only draws it. A chart whose numbers
// live somewhere else is a second copy waiting to disagree.
//
// Three forms, chosen by the job the data does:
//   series — a value changing across steps       (line)
//   bars   — magnitudes compared                 (horizontal bars)
//   stack  — parts of one total                  (single stacked bar)
//
// No JavaScript: hover comes from SVG <title>, which every browser surfaces
// natively. Colours are slots 1-3 of the validated categorical order, carried
// as theme tokens so both modes are selected rather than flipped.

import { esc, attr } from './html.mjs'
import { resolveMeasure } from '../capture-proxy/measure.mjs'

const PALETTE = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']
const AXIS = 'var(--rule)'
const INK = 'var(--ink-faint)'

const fmt = (n) => n.toLocaleString('en-US')

/**
 * Parse the fenced body. One `key: value` per line; repeated keys accumulate.
 * Deliberately line-based so the Markdown source stays readable as text — the
 * note is the source of truth and has to survive being read without a browser.
 */
export function parseChartSpec(body, measurements) {
  const spec = { series: [], bars: [], parts: [] }
  /** `@capture.field` pulls the numbers from measurements.json instead of the note. */
  const numbers = (raw) => raw.trim().startsWith('@')
    ? [resolveMeasure(raw.trim(), measurements)].flat()
    : raw.split(',').map((n) => Number(n.trim().replace(/_/g, '')))
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const at = line.indexOf(':')
    if (at === -1) continue
    const key = line.slice(0, at).trim()
    const value = line.slice(at + 1).trim()
    // `bars` expands one array reference into a numbered bar per element, so a
    // nine-element measurement is not nine hand-written lines that can drift.
    if (key === 'bars') {
      const bar = value.indexOf('|')
      const prefix = bar === -1 ? '' : value.slice(0, bar).trim()
      const values = numbers(bar === -1 ? value : value.slice(bar + 1))
      values.forEach((v, i) => spec.bars.push({ label: `${prefix} ${i + 1}`.trim(), value: v }))
      continue
    }
    if (key === 'series' || key === 'bar' || key === 'part') {
      const bar = value.indexOf('|')
      if (bar === -1) continue
      const label = value.slice(0, bar).trim()
      const values = numbers(value.slice(bar + 1))
      if (values.some(Number.isNaN)) throw new Error(`chart: "${label}" has a non-numeric value`)
      if (key === 'series') spec.series.push({ label, values })
      else if (key === 'bar') spec.bars.push({ label, value: values[0] })
      else spec.parts.push({ label, value: values[0] })
    } else {
      spec[key] = value
    }
  }
  if (!spec.kind) throw new Error('chart: missing "kind"')
  return spec
}

const frame = (spec, svg, keyRows) => {
  const key = keyRows.length
    ? `<p class="viz-k">${keyRows.join('')}</p>`
    : ''
  return `<figure class="viz">`
    + (spec.title ? `<p class="viz-t">${esc(spec.title)}</p>` : '')
    + svg
    + key
    + (spec.caption ? `<figcaption>${esc(spec.caption)}</figcaption>` : '')
    + `</figure>`
}

const swatch = (colour, label) =>
  `<span><span class="viz-sw" style="background:${colour}"></span><b>${esc(label)}</b></span>`

/** A value changing across steps. Direct-labelled at the last point of each line. */
function series(spec) {
  const W = 720, H = 260, L = 54, R = 132, T = 18, B = 34
  const all = spec.series.flatMap((s) => s.values)
  const max = Math.max(...all, 1)
  const longest = Math.max(...spec.series.map((s) => s.values.length))
  const x = (i) => L + (longest === 1 ? 0 : (i * (W - L - R)) / (longest - 1))
  const y = (v) => T + (H - T - B) * (1 - v / max)

  // Four recessive gridlines; the axis carries the numbers, the marks do not.
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const value = max * f
    return `<line x1="${L}" y1="${y(value)}" x2="${W - R}" y2="${y(value)}" stroke="${AXIS}" stroke-width="1"/>`
      + `<text x="${L - 8}" y="${y(value) + 4}" text-anchor="end" font-size="10" fill="${INK}"`
      + ` font-family="ui-monospace, Menlo, monospace">${fmt(Math.round(value))}</text>`
  }).join('')

  const ticks = Array.from({ length: longest }, (_, i) =>
    `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="10" fill="${INK}"`
    + ` font-family="ui-monospace, Menlo, monospace">${i + 1}</text>`).join('')

  const lines = spec.series.map((s, index) => {
    const colour = PALETTE[index % PALETTE.length]
    const path = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
    const dots = s.values.map((v, i) =>
      `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${colour}">`
      + `<title>${esc(s.label)} · step ${i + 1} · ${fmt(v)}</title></circle>`).join('')
    const lastIndex = s.values.length - 1
    // Direct label: the relief the contrast WARN obliges, and it removes the
    // legend lookup for anyone reading a single line.
    const label = `<text x="${x(lastIndex) + 10}" y="${y(s.values[lastIndex]) + 4}" font-size="11"`
      + ` fill="${INK}" font-family="ui-monospace, Menlo, monospace">${esc(s.label)}</text>`
    return `<path d="${path}" fill="none" stroke="${colour}" stroke-width="2"`
      + ` stroke-linejoin="round" stroke-linecap="round"/>${dots}${label}`
  }).join('')

  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(spec.title ?? 'series chart')}">`
    + grid + ticks + lines
    + `<text x="${L}" y="${H - 12}" font-size="10" fill="${INK}" text-anchor="end"`
    + ` font-family="ui-monospace, Menlo, monospace" dx="-14">${esc(spec.x ?? 'step')}</text>`
    + `</svg>`

  return frame(spec, svg, spec.series.map((s, i) => swatch(PALETTE[i % PALETTE.length], s.label)))
}

/** Magnitudes compared. Bars carry their own value, so no axis is needed. */
function bars(spec) {
  const W = 720, ROW = 26, GAP = 2, L = 190, R = 96, T = 6
  const max = Math.max(...spec.bars.map((b) => b.value), 1)
  const H = T * 2 + spec.bars.length * ROW
  const colour = PALETTE[0]

  const rows = spec.bars.map((b, i) => {
    const yTop = T + i * ROW
    const width = Math.max(2, ((W - L - R) * b.value) / max)
    // Highlight by value, not by label: the point of the figure is that a number
    // recurring to the byte is a ceiling, and that must be read off the data.
    const highlight = (spec.highlight && b.label.includes(spec.highlight))
      || (spec.highlightValue !== undefined && b.value === Number(spec.highlightValue))
    return `<text x="${L - 12}" y="${yTop + ROW / 2 + 4}" text-anchor="end" font-size="11" fill="${INK}"`
      + ` font-family="ui-monospace, Menlo, monospace">${esc(b.label)}</text>`
      + `<rect x="${L}" y="${yTop + GAP}" width="${width}" height="${ROW - GAP * 2}" rx="4"`
      + ` fill="${highlight ? PALETTE[1] : colour}">`
      + `<title>${esc(b.label)} · ${fmt(b.value)}</title></rect>`
      + `<text x="${L + width + 10}" y="${yTop + ROW / 2 + 4}" font-size="11" fill="${INK}"`
      + ` font-family="ui-monospace, Menlo, monospace">${fmt(b.value)}${spec.unit ? ` ${esc(spec.unit)}` : ''}</text>`
  }).join('')

  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(spec.title ?? 'bar chart')}">${rows}</svg>`
  const marked = spec.highlight ?? spec.highlightValue
  const key = marked !== undefined ? [swatch(PALETTE[1], spec.highlightLabel ?? String(marked))] : []
  return frame(spec, svg, key)
}

/** Parts of one total, as a single bar. Segments are labelled beneath. */
function stack(spec) {
  const W = 720, H = 58, GAP = 2
  const total = spec.parts.reduce((sum, p) => sum + p.value, 0) || 1
  let cursor = 0
  const segments = spec.parts.map((p, index) => {
    const width = Math.max(1, (W * p.value) / total - GAP)
    const x = cursor
    cursor += (W * p.value) / total
    return `<rect x="${x}" y="0" width="${width}" height="26" rx="4"`
      + ` fill="${PALETTE[index % PALETTE.length]}">`
      + `<title>${esc(p.label)} · ${fmt(p.value)} (${Math.round((p.value / total) * 100)}%)</title></rect>`
  }).join('')

  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(spec.title ?? 'composition')}">`
    + segments
    + `<text x="0" y="48" font-size="10" fill="${INK}" font-family="ui-monospace, Menlo, monospace">`
    + `${fmt(total)}${spec.unit ? ` ${esc(spec.unit)}` : ''} total</text>`
    + `</svg>`

  const key = spec.parts.map((p, i) =>
    swatch(PALETTE[i % PALETTE.length], `${p.label} ${fmt(p.value)} · ${Math.round((p.value / total) * 100)}%`))
  return frame(spec, svg, key)
}

export function renderChart(body, measurements) {
  const spec = parseChartSpec(body, measurements)
  if (spec.kind === 'series') return series(spec)
  if (spec.kind === 'bars') return bars(spec)
  if (spec.kind === 'stack') return stack(spec)
  throw new Error(`chart: unknown kind "${spec.kind}"`)
}
