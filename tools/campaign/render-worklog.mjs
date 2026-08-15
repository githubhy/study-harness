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

// An empty log left the Trail as a bare heading with nothing under it, while the frontier directly
// above it said so in words. Before the first finding lands that is the whole page's state, so it
// is worth a sentence rather than a silence.
const trail = (data, derived) => derived.trail.length === 0
  ? '<p class="lede">Nothing logged yet. The first finding starts the trail.</p>'
  : derived.trail.map((e) => {
    const t = derived.threads.get(e.thread)
    const newest = e === t.entries.at(-1)
    const state = t.state === 'dry' && newest ? 'dry' : 'live'
    // Where #tX lands. Every letter in the coverage strip and every roadmap.html#tX link points at
    // the thread's newest trail entry — the spec's "every letter anchors to its trail entries".
    // The anchor rides inside the entry rather than on it because an element carries one id and the
    // entry keeps its own, which the id-uniqueness check below relies on.
    const anchor = newest ? `<span id="t${attr(e.thread)}"></span>` : ''
    const opened = e.opened.map((o) => `→ opened: ${rich(o.q)} (${esc(o.ask)})`).join('<br>')
    const issue = e.issue != null ? ` · filed #${esc(String(e.issue))}` : ''
    // Thread plus date is not unique: two findings on one thread on one day collide. The index is
    // the entry's position in its own thread's history, so appending a finding never renumbers the
    // entries already published.
    const n = t.entries.indexOf(e)
    return `<div class="entry" data-state="${attr(state)}" id="e-${attr(`${e.thread}${e.date}-${n}`)}">${anchor}`
         + `<b><a href="roadmap.html#t${esc(e.thread)}">${esc(e.thread)} · ${esc(t.name)}</a></b> `
         + `<span class="mono">${esc(e.pips)} ${esc(e.date)}</span><br>${rich(e.finding)}<br>`
         + `<span class="mono">${opened}${opened ? ' · ' : ''}${esc(e.note)}${issue}</span></div>`
    }).join('\n')

// Only threads with no trail entry: those have nowhere in the trail to anchor, and without a
// fallback the strip's own pip link and the roadmap's → worklog link would both dangle. A thread
// that has entries is anchored on its newest one instead, so emitting a bare anchor for it here
// would put #tX back at the top of the section — which is the whole defect.
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
    '<section><h2 class="sec">Open questions</h2>', frontier(derived), '</section>',
    '<section><h2 class="sec">Trail</h2>', anchors(data, derived), trail(data, derived), '</section>',
    `<footer><span><a href="roadmap.html">← roadmap</a></span>`,
    `<span><a href="../index.html">all campaigns</a></span></footer>`,
    '</main></div>',
  ].filter(Boolean).join('\n')
}
