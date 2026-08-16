import { CSS } from './theme.mjs'
import { esc, rich, attr, GENERATED_MARKER } from './html.mjs'
import { renderGraph } from './graph.mjs'
import { renderSpine, renderReports, renderFrontier } from './spine.mjs'

// The worklog: what the campaign found, led by the findings.
//
// Almost every instrument here used to be built for a campaign in flight — pips counting down a
// surprise budget, dry detection, a frontier, a "live" list — and this campaign is finished, so the
// page's most prominent objects were reporting the absence of something. The layout serves both
// states now: findings lead, and the work-in-progress instruments stay but subordinate, rendering
// **empty rather than absent** when there is nothing to report.
//
// Findings are filed under the loop's five steps rather than under fifteen thread letters, because
// "Assemble" and "Execute" mean something to a reader who has never heard of thread J.

const strip = (derived) => {
  // Kept for narrow widths, where the rail's spine is too tall to lead with. Band grouping and order
  // come from derived.bands — the one ordering every figure on the site shares.
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

/**
 * One finding.
 *
 * The surprise mark is the point of the change here. 34 of this campaign's 46 findings were logged
 * surprising, and nothing on the page said so — the signal existed only aggregated into a thread's
 * pips. It reuses the campaign's own vocabulary rather than inventing a second one: a filled pip for
 * a finding that moved the model, a hollow one for a finding that confirmed it.
 */
const entry = (e, derived, { thread = null, label = '' } = {}) => {
  const opened = e.opened.map((o) => `→ opened: ${rich(o.q)} (${esc(o.ask)})`).join('<br>')
  // A resolution names the question it closed and the thread that asked it, so the trail shows a
  // question being answered rather than quietly vanishing from the frontier.
  const answered = e.resolved
    .map((id) => derived.questions.get(id))
    .filter(Boolean)
    .map((q) => `→ answered ${esc(q.from)}: ${rich(q.q)}`).join('<br>')
  const marks = [opened, answered].filter(Boolean).join('<br>')
  const issue = e.issue != null ? ` · filed #${esc(String(e.issue))}` : ''
  const note = `<a href="${attr(e.note.replace(/\.md$/, '.html'))}">${esc(e.note)}</a>`
  const surprise = e.surprising
    ? '<span class="surp" data-s="yes" title="Surprising — this moved the model">●</span>'
    : '<span class="surp" data-s="no" title="Not surprising — this confirmed the model">○</span>'
  // Only the finding that tipped a thread dry carries the dry state; earlier ones on the same
  // now-dry thread stay live, because they were live when they landed. `entries` arrives newest
  // first, so the tipping one is the head.
  const state = thread && thread.state === 'dry' && e === thread.entries[0] ? 'dry' : 'live'
  // The anchor comes from derive, not from this renderer: the thread graph links to these same ids,
  // and an id invented in two places is one that will eventually disagree with itself.
  return `<article class="entry" data-state="${attr(state)}" `
       + `data-surprising="${e.surprising ? 'yes' : 'no'}" id="${attr(e.entryId)}">`
       + `<p class="e-top">${surprise}${label}<span class="mono">${esc(e.date)}</span></p>`
       + `<p class="e-body">${rich(e.finding)}</p>`
       + `<p class="mono e-foot">${marks}${marks ? ' · ' : ''}${note}${issue}</p></article>`
}

/**
 * A thread inside a section.
 *
 * Hybrid by design: a thread with more than one finding earns a block; a thread with exactly one is
 * a single labelled finding. Either way it owns exactly one element carrying `id="t{letter}"` — the
 * roadmap links to it, and so does every node and most arcs in the thread graph.
 */
const threadIn = (t, derived) => {
  const note = t.note ? ` · <a href="notes/${attr(t.note)}">read the note</a>` : ''
  if (t.shape === 'single') {
    const label = `<b><a href="roadmap.html#t${esc(t.letter)}">${esc(t.letter)} · ${esc(t.name)}</a></b>`
    return `<div class="tsingle" id="t${attr(t.letter)}">`
         + entry(t.entries[0], derived, { thread: t, label: `${label} <span class="mono">${t.pips}${note}</span> ` })
         + '</div>'
  }
  const n = t.entries.length
  return `<section class="tgroup" data-state="${attr(t.state)}" id="t${attr(t.letter)}">`
       + `<h3 class="tgroup-h"><b><a href="roadmap.html#t${esc(t.letter)}">`
       + `${esc(t.letter)} · ${esc(t.name)}</a></b>`
       + `<span class="mono">${esc(t.pips)} · ${n} findings`
       + `${t.state === 'dry' ? ' · dry' : ''}${note}</span></h3>`
       + t.entries.map((e) => entry(e, derived, { thread: t })).join('')
       + '</section>'
}

const sections = (derived) => derived.sections.length === 0
  ? '<p class="lede">Nothing logged yet. The first finding starts the record.</p>'
  : derived.sections.map((s) => {
    const n = s.threads.reduce((a, t) => a + t.entries.length, 0)
    return `<section class="lstep" id="s-${attr(s.id)}">`
         + `<header class="lstep-h"><p class="kick">${esc(s.step)}</p>`
         + `<h2>${esc(s.label)}</h2><p class="lede">${rich(s.question)}</p>`
         + `<p class="mono">${s.threads.length} thread${s.threads.length === 1 ? '' : 's'} · `
         + `${n} finding${n === 1 ? '' : 's'}</p></header>`
         + s.threads.map((t) => threadIn(t, derived)).join('')
         + '</section>'
  }).join('')

// Only threads with no finding at all: they get no home in a section, and without a fallback the
// spine's own link and the roadmap's would both dangle.
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
    '<div class="wl">',
    // The rail: the coverage strip, the thread graph and the contents as one object, plus the
    // reports in reading order and the frontier. Sticky at wide widths; a plain block below the
    // breakpoint, where the spine gives way to the strip and the horizontal figure.
    `<aside class="rail">${renderReports({ derived })}${renderSpine({ derived })}`,
    `${renderFrontier({ derived })}</aside>`,
    '<div class="wl-main">',
    strip(derived),
    anchors(data, derived),
    sections(derived),
    renderGraph({ data, derived }),
    '</div></div>',
    `<footer><span><a href="roadmap.html">← roadmap</a></span>`,
    `<span><a href="../index.html">all campaigns</a></span></footer>`,
    '</main></div>',
  ].filter(Boolean).join('\n')
}
