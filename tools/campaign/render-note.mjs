// Renders a campaign note from its Markdown source, so the note has one home.
// Hand-writing an HTML copy would put the same prose in two files with nothing
// keeping them equal — the defect this generator exists to remove.
//
// Deliberately a small Markdown subset: exactly what the notes use. An
// unsupported construct should look wrong immediately rather than degrade
// quietly, so nothing is silently swallowed.

import { CSS } from './theme.mjs'
import { esc, attr, GENERATED_MARKER } from './html.mjs'
import { renderChart } from './render-chart.mjs'
import { renderDiagram } from './render-diagram.mjs'

/**
 * Inline spans.
 *
 * Splitting on the backtick means odd segments are inside code and even ones
 * are not, so emphasis is applied only outside code without needing a
 * placeholder. An earlier version substituted a marker and restored it
 * afterwards, which is a whole class of bug — any marker you can write, prose
 * can also contain.
 */
const inline = (text) =>
  String(text)
    .split('`')
    .map((segment, index) =>
      index % 2 === 1
        ? `<code>${esc(segment)}</code>`
        : esc(segment)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${attr(href)}">${label}</a>`),
    )
    .join('')

const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line)
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

/** A row of only dashes and colons is the header rule, not content. */
const isTableRule = (line) => isTableRow(line) && cells(line).every((c) => /^:?-{2,}:?$/.test(c))

const isBlockStart = (line) =>
  line.startsWith('```') || /^#{1,4}\s/.test(line) || isTableRow(line) || /^\s*[-*]\s+/.test(line)

export function renderNoteBody(markdown, measurements) {
  const lines = markdown.split('\n')
  const out = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.startsWith('```')) {
      const info = line.slice(3).trim()
      const body = []
      index++
      while (index < lines.length && !lines[index].startsWith('```')) body.push(lines[index++])
      index++ // the closing fence
      // A `chart` fence is data, not sample code: it renders. Everything else is
      // shown verbatim. A malformed spec throws rather than emitting a broken
      // figure — a chart that silently draws nothing is worse than a build error.
      out.push(
        info === 'chart' ? renderChart(body.join('\n'), measurements)
        : info === 'diagram' ? renderDiagram(body.join('\n'))
        : `<pre>${esc(body.join('\n'))}</pre>`)
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      out.push(
        level === 1
          ? `<h1>${inline(heading[2])}</h1>`
          : `<h${level} class="sec">${inline(heading[2])}</h${level}>`,
      )
      index++
      continue
    }

    if (isTableRow(line)) {
      const header = cells(line)
      index++
      if (index < lines.length && isTableRule(lines[index])) index++
      const body = []
      while (index < lines.length && isTableRow(lines[index])) body.push(cells(lines[index++]))
      out.push(
        '<div class="tw"><table><thead><tr>'
        + header.map((c) => `<th>${inline(c)}</th>`).join('')
        + '</tr></thead><tbody>'
        + body.map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
        + '</tbody></table></div>',
      )
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index++].replace(/^\s*[-*]\s+/, ''))
      }
      out.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`)
      continue
    }

    if (line.trim() === '') { index++; continue }

    const paragraph = []
    while (index < lines.length && lines[index].trim() !== '' && !isBlockStart(lines[index])) {
      paragraph.push(lines[index++])
    }
    out.push(`<p class="lede">${inline(paragraph.join(' '))}</p>`)
  }

  return out.join('\n')
}

/** A full page for one note. `back` links to the roadmap that cites it. */
export function renderNote({ markdown, campaign, title, back = 'roadmap.html', measurements }) {
  return [
    '<meta charset="utf-8">',
    GENERATED_MARKER,
    `<title>${esc(title)}</title>`,
    CSS,
    '<div class="page"><main>',
    `<header class="mast"><p class="kick">Note · ${esc(campaign)}</p></header>`,
    renderNoteBody(markdown, measurements),
    `<footer><span><a href="${attr(back)}">← roadmap</a></span>`
      + `<span><a href="worklog.html">worklog</a></span>`
      + `<span><a href="../index.html">all campaigns</a></span></footer>`,
    '</main></div>',
  ].filter(Boolean).join('\n')
}
