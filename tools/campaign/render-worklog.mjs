import { CSS } from './theme.mjs'
import { esc, rich, attr, GENERATED_MARKER } from './html.mjs'
import { renderGraph } from './graph.mjs'

const strip = (data, derived) => {
  // Band grouping and within-band order come from derived.bands, the same list §4 renders from —
  // "same order as the roadmap's §4 bands" is a spec requirement, so it cannot be a second sort
  // here that happens to agree.
  const bands = derived.bands.map((band) => {
    const letters = band.letters.map((l) => {
      const d = derived.threads.get(l)
      return `<a class="pip" data-state="${attr(d.state)}" href="#t${esc(d.letter)}" `
           + `title="${attr(d.name)}">${esc(d.letter)} ${esc(d.pips)}</a>`
    }).join('')
    return `<div class="strip-band" data-band="${attr(band.id)}">`
         + `<span class="strip-label">${esc(band.label)}</span>${letters}</div>`
  }).join('')
  const { touched, dry, notStarted } = derived.totals
  const live = derived.live.length ? `live · ${derived.live.map(esc).join(' ')}` : 'live · none'
  return `<div class="strip"><div class="strip-label">`
       + `${touched} touched · ${dry} dry · ${notStarted} not started &nbsp; ${live}`
       + `</div><div class="strip-row">${bands}</div></div>`
}

const frontier = (derived) => derived.frontier.length === 0
  ? '<p class="lede">No open questions. The next thread is a fresh pick.</p>'
  : `<ul class="frontier">${derived.frontier.map((q) =>
      `<li>${rich(q.q)} <span class="mono">from ${esc(q.from)} → ask ${esc(q.ask)}</span></li>`).join('')}</ul>`

const entry = (e, group, derived) => {
  const newest = e === group.entries[0]
  const state = group.state === 'dry' && newest ? 'dry' : 'live'
  const opened = e.opened.map((o) => `→ opened: ${rich(o.q)} (${esc(o.ask)})`).join('<br>')
  // A resolution names the question it closed and the thread that asked it. Both halves of the
  // graph render, so the trail shows a question being answered rather than quietly vanishing
  // from the frontier.
  const answered = e.resolved
    .map((id) => derived.questions.get(id))
    .filter(Boolean)
    .map((q) => `→ answered ${esc(q.from)}: ${rich(q.q)}`).join('<br>')
  const marks = [opened, answered].filter(Boolean).join('<br>')
  const issue = e.issue != null ? ` · filed #${esc(String(e.issue))}` : ''
  // The note holding this finding, as a link rather than the filename in plain text. The log stores
  // the Markdown source, which is what the build validates exists; the page next to it is what a
  // reader on the site can open.
  const note = `<a href="${attr(e.note.replace(/\.md$/, '.html'))}">${esc(e.note)}</a>`
  // Thread plus date is not unique: two findings on one thread on one day collide. The index is
  // the entry's position in its own thread's history, so appending a finding never renumbers the
  // entries already published. Counted from the oldest, so it survives the newest-first display.
  const n = group.entries.length - 1 - group.entries.indexOf(e)
  return `<div class="entry" data-state="${attr(state)}" id="e-${attr(`${e.thread}${e.date}-${n}`)}">`
       + `<span class="mono">${esc(e.pips)} ${esc(e.date)}</span><br>${rich(e.finding)}<br>`
       + `<span class="mono">${marks}${marks ? ' · ' : ''}${note}${issue}</span></div>`
}

// Every note the campaign has written, in one place. The reports read in order; the thread notes are
// the evidence each one argues from, so they carry their pips and finding count and sit in the same
// band order as everything else on this page.
const noteIndex = (derived) => {
  const { reports, threads } = derived.noteIndex
  if (reports.length === 0 && threads.length === 0) return ''
  const order = derived.bands.flatMap((b) => b.letters)
  const sorted = [...threads].sort((a, b) => order.indexOf(a.letter) - order.indexOf(b.letter))
  return '<section><h2 class="sec">The notes</h2>'
    + `<p class="lede">All ${reports.length + sorted.length}. The numbered reports read in order and`
    + ' carry the study; the thread notes are the evidence they argue from.</p>'
    + `<div class="notes-ix"><div><h3 class="nx-h">Reports</h3><ol class="nx">`
    + reports.map((r) => `<li><a href="${attr(r.href)}">${esc(r.label)}</a></li>`).join('')
    + `</ol></div><div><h3 class="nx-h">Threads</h3><ul class="nx">`
    + sorted.map((t) => `<li><a href="${attr(t.href)}">${esc(t.letter)} · ${esc(t.name)}</a>`
        + ` <span class="mono">${esc(t.pips)} ${t.findings}</span></li>`).join('')
    + '</ul></div></div></section>'
}

// One block per thread, in the same band order as the coverage strip above and the roadmap's §4,
// so a pip and the section it jumps to are in agreement. The trail used to be flat and
// chronological, which sounds like the neutral choice and was not: every entry in this campaign
// carries the same date, so the ordering sorted nothing, and the thread letter — the axis a reader
// actually navigates by — was present only as a repeated label. Anyone after one thread's findings
// read all forty-six.
//
// An empty log left the Trail as a bare heading with nothing under it, while the frontier directly
// above it said so in words. Before the first finding lands that is the whole page's state, so it
// is worth a sentence rather than a silence.
const trail = (data, derived) => derived.trailByThread.length === 0
  ? '<p class="lede">Nothing logged yet. The first finding starts the trail.</p>'
  : derived.trailByThread.map((g) => {
    const n = g.entries.length
    // Where #tX lands: the thread's own heading, which is now the top of everything it found.
    // Previously it pointed at the newest single entry, since that was the only place in a flat
    // chronological list where a thread could be said to begin.
    // The thread's own note, at the head of everything it found — the one place a reader who has
    // just read the findings would look for the long form.
    const note = derived.noteFor.has(g.letter)
      ? ` · <a href="notes/${attr(derived.noteFor.get(g.letter))}">read the note</a>` : ''
    return `<section class="tgroup" data-state="${attr(g.state)}" id="t${attr(g.letter)}">`
         + `<h3 class="tgroup-h"><b><a href="roadmap.html#t${esc(g.letter)}">`
         + `${esc(g.letter)} · ${esc(g.name)}</a></b>`
         + `<span class="mono">${esc(g.pips)} · ${n} finding${n === 1 ? '' : 's'}`
         + `${g.state === 'dry' ? ' · dry' : ''}${note}</span></h3>`
         + g.entries.map((e) => entry(e, g, derived)).join('\n')
         + '</section>'
    }).join('\n')

// Only threads with no trail entry: those get no group above, and without a fallback the strip's
// own pip link and the roadmap's → worklog link would both dangle.
const anchors = (data, derived) => data.threads
  .filter((t) => derived.threads.get(t.letter).entries.length === 0)
  .map((t) => `<span id="t${attr(t.letter)}"></span>`).join('')

export function renderWorklog({ data, derived }) {
  return [
    '<meta charset="utf-8">',
    GENERATED_MARKER,
    `<title>${esc(data.title)} · Worklog</title>`,
    CSS,
    '<div class="page"><main>',
    `<header class="mast"><p class="kick">Worklog · ${esc(data.campaign)}</p>`,
    `<h1>${esc(data.title)} · what has happened</h1></header>`,
    strip(data, derived),
    renderGraph({ data, derived }),
    noteIndex(derived),
    '<section><h2 class="sec">Open questions</h2>', frontier(derived), '</section>',
    '<section><h2 class="sec">Trail</h2>', anchors(data, derived), trail(data, derived), '</section>',
    `<footer><span><a href="roadmap.html">← roadmap</a></span>`,
    `<span><a href="../index.html">all campaigns</a></span></footer>`,
    '</main></div>',
  ].filter(Boolean).join('\n')
}
