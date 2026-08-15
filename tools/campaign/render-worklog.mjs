import { CSS } from './theme.mjs'
import { esc, rich, attr } from './html.mjs'
import { renderGraph } from './graph.mjs'

const strip = (data, derived) => {
  const bands = data.loopSteps.map((step) => {
    const letters = data.threads.filter((t) => t.loop === step.id)
      .sort((a, b) => a.letter.localeCompare(b.letter))
      .map((t) => {
        const d = derived.threads.get(t.letter)
        return `<a class="pip" data-state="${attr(d.state)}" href="#t${esc(t.letter)}" `
             + `title="${attr(t.name)}">${esc(t.letter)} ${esc(d.pips)}</a>`
      }).join('')
    return `<div class="strip-band" data-band="${attr(step.id)}">`
         + `<span class="strip-label">${esc(step.label)}</span>${letters}</div>`
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

const trail = (data, derived) => derived.trail.map((e) => {
  const t = derived.threads.get(e.thread)
  const state = t.state === 'dry' && e === t.entries.at(-1) ? 'dry' : 'live'
  const opened = e.opened.map((o) => `→ opened: ${rich(o.q)} (${esc(o.ask)})`).join('<br>')
  const issue = e.issue != null ? ` · filed #${esc(String(e.issue))}` : ''
  return `<div class="entry" data-state="${attr(state)}" id="e-${attr(e.thread + e.date)}">`
       + `<b><a href="roadmap.html#t${esc(e.thread)}">${esc(e.thread)} · ${esc(t.name)}</a></b> `
       + `<span class="mono">${esc(e.pips)} ${esc(e.date)}</span><br>${rich(e.finding)}<br>`
       + `<span class="mono">${opened}${opened ? ' · ' : ''}${esc(e.note)}${issue}</span></div>`
}).join('\n')

const anchors = (data) => data.threads
  .map((t) => `<span id="t${attr(t.letter)}"></span>`).join('')

export function renderWorklog({ data, derived }) {
  return [
    '<meta charset="utf-8">',
    `<title>${esc(data.title)} · Worklog</title>`,
    CSS,
    '<div class="page"><main>',
    `<header class="mast"><p class="kick">Worklog · ${esc(data.campaign)}</p>`,
    `<h1>${esc(data.title)} · what has happened</h1></header>`,
    strip(data, derived),
    renderGraph({ data, derived }),
    '<section><h2 class="sec">Open questions</h2>', frontier(derived), '</section>',
    '<section><h2 class="sec">Trail</h2>', anchors(data), trail(data, derived), '</section>',
    `<footer><span><a href="roadmap.html">← roadmap</a></span>`,
    `<span><a href="../index.html">all campaigns</a></span></footer>`,
    '</main></div>',
  ].join('\n')
}
