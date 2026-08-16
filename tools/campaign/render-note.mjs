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
 * Turn the notes' own cross-thread idioms into links.
 *
 * The notes refer to each other constantly — "→ **J**" closing a Questions section, "Thread D
 * showed the …" mid-sentence — and every one of those was a dead end: the roadmap linked into all
 * fifteen notes and nothing linked between them, so the thread graph the worklog draws existed as a
 * picture and not as navigation. Doing it here rather than by writing Markdown links into the prose
 * keeps the sources readable and makes it impossible for a reference to rot: `notes` is derived
 * from the log, so a letter with no note of its own is left as plain text rather than linked to a
 * file nobody wrote.
 *
 * Both patterns require their own context — an arrow before the bold letter, the literal word
 * "Thread" before the bare one — because a lone capital is far too common in this prose to treat as
 * a reference. Self-references are skipped: a note linking to itself is noise.
 */
const linkThreads = (html, notes, self) => {
  const link = (letter, label) => {
    const href = notes?.get(letter)
    return href && letter !== self ? `<a class="tref" href="${attr(href)}">${label}</a>` : label
  }
  return html
    // "→ **J**" — how every note ends a "Questions this opens" bullet.
    .replace(/→(\s*)\*\*([A-O])\*\*/g, (_, gap, l) => `→${gap}${link(l, `<strong>${l}</strong>`)}`)
    // "Thread D" in running prose. The word boundary leaves a possessive's "'s" outside the link.
    .replace(/\bThread ([A-O])\b/g, (m, l) => link(l, m))
}

/**
 * Inline spans.
 *
 * Splitting on the backtick means odd segments are inside code and even ones
 * are not, so emphasis is applied only outside code without needing a
 * placeholder. An earlier version substituted a marker and restored it
 * afterwards, which is a whole class of bug — any marker you can write, prose
 * can also contain.
 *
 * Thread references resolve before emphasis so "→ **J**" is still recognisable as itself; by the
 * time the `**` pass runs, that span is already an anchor and has no asterisks left to match.
 */
const inline = (text, notes, self) =>
  String(text)
    .split('`')
    .map((segment, index) =>
      index % 2 === 1
        ? `<code>${esc(segment)}</code>`
        : linkThreads(esc(segment), notes, self)
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

export function renderNoteBody(markdown, measurements, { notes, self } = {}) {
  const lines = markdown.split('\n')
  const out = []
  let index = 0
  /** Every inline span in this note shares one thread-reference map and one self letter. */
  const md = (text) => inline(text, notes, self)

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
          ? `<h1>${md(heading[2])}</h1>`
          : `<h${level} class="sec">${md(heading[2])}</h${level}>`,
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
        + header.map((c) => `<th>${md(c)}</th>`).join('')
        + '</tr></thead><tbody>'
        + body.map((row) => `<tr>${row.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')
        + '</tbody></table></div>',
      )
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index++].replace(/^\s*[-*]\s+/, ''))
      }
      out.push(`<ul>${items.map((item) => `<li>${md(item)}</li>`).join('')}</ul>`)
      continue
    }

    if (line.trim() === '') { index++; continue }

    const paragraph = []
    while (index < lines.length && lines[index].trim() !== '' && !isBlockStart(lines[index])) {
      paragraph.push(lines[index++])
    }
    out.push(`<p class="lede">${md(paragraph.join(' '))}</p>`)
  }

  return out.join('\n')
}

/**
 * A full page for one note.
 *
 * Every footer target is a parameter with a note-relative default, because the two that were
 * hardcoded were written from the roadmap's directory and this page lives one level below it:
 * `worklog.html` resolved to `notes/worklog.html` and `../index.html` to the campaign directory,
 * so two of the three links on all twenty-two note pages were dead. The link check in
 * build-campaign.mjs now resolves these against disk, which is what would have caught it.
 */
export function renderNote({
  markdown, campaign, title, measurements, notes, self,
  back = '../roadmap.html', worklog = '../worklog.html', home = '../../index.html',
}) {
  return [
    '<meta charset="utf-8">',
    GENERATED_MARKER,
    `<title>${esc(title)}</title>`,
    CSS,
    '<div class="page"><main>',
    `<header class="mast"><p class="kick">Note · ${esc(campaign)}</p></header>`,
    renderNoteBody(markdown, measurements, { notes, self }),
    `<footer><span><a href="${attr(back)}">← roadmap</a></span>`
      + `<span><a href="${attr(worklog)}">worklog</a></span>`
      + `<span><a href="${attr(home)}">all campaigns</a></span></footer>`,
    '</main></div>',
  ].filter(Boolean).join('\n')
}
