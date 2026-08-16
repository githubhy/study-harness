import { CSS } from './theme.mjs'
import { esc, rich, attr, GENERATED_MARKER } from './html.mjs'

// ---------- one card per campaign ----------

// The hand-written board's `.roles` dl (`<dt>Subject</dt>`/`<dt>Specimen</dt>`/
// `<dt>Transfer specimen</dt>`, each above its value) has no counterpart in theme.mjs. The nearest
// equivalent is `.n-id` + `.n-t` — the map figure's small-caps label over a bold mono value, whose
// CSS (mono, uppercase, letter-spacing .14em, ink-faint) is nearly byte-identical to the old
// `.role dt` rule. Three label/value stacks sit inside `.facts`, the same flex-row container the
// roadmap masthead already uses for its own specimen/pinned/packages facts.
const role = (label, value) => `<div><div class="n-id">${esc(label)}</div><div class="n-t">${value}</div></div>`

const card = ({ data, derived }) => {
  const { touched, dry, notStarted } = derived.totals
  const newest = derived.trail[0]
  const resume = newest
    ? `${rich(newest.finding)} <span class="mono">— ${esc(newest.thread)} · ${esc(newest.date)}</span>`
    : 'not started'
  const state = touched === 0 ? 'not started' : `${touched} touched · ${dry} dry`

  return `<article class="card" data-s="go">
      <div class="c-top">
        <span class="letter">${esc(data.campaign)}</span>
        <h3 class="c-t">${esc(data.title)}</h3>
        <span class="c-state">${esc(state)}</span>
      </div>
      <p class="lede">${rich(data.copy.standfirst)}</p>
      <div class="facts">
        ${role('Subject', `<b>${esc(data.subject)}</b>`)}
        ${role('Specimen', `<b>${esc(data.specimen.name)}</b> @ <b>${esc(data.specimen.pinned)}</b>`)}
        ${role('Transfer specimen', `<b>${esc(data.transferSpecimen.name)}</b> · <b>${esc(data.transferSpecimen.via)}</b>`)}
      </div>
      <p class="mono" data-role="resume">${resume}</p>
      <p class="mono" data-role="totals">${touched} touched · ${dry} dry · ${notStarted} not started</p>
      ${synthesis({ data, derived })}
      <p class="c-blocks"><a href="${attr(data.campaign)}/roadmap.html">roadmap.html</a> · <a href="${attr(data.campaign)}/worklog.html">worklog.html</a></p>
    </article>`
}

// The campaign's conclusion, from the same `synthesis` block the roadmap masthead renders — one home
// for the text, two places that link it. The board is the front door and the answer was two clicks
// past it: in to the roadmap, then down to the "Start here" line. A reader who wants the finding
// rather than the method should not have to walk the method to reach it. Only the href differs, and
// only because the board sits one directory above the campaign.
const synthesis = ({ data }) => {
  const s = data.synthesis
  if (!s) return ''
  return `<p class="synth"><a href="${attr(`${data.campaign}/${s.href}`)}"><b>${esc(s.title)}</b></a> — ${rich(s.blurb)}</p>`
}

// ---------- Active: cards, plus the empty-state block while there's only one campaign ----------

// The hand-written `.empty` box (dashed border, sunk background) also has no theme.mjs equivalent,
// so it borrows `.cell` — the same plain bordered box the roadmap uses for claims and standing
// orders. Content-wise it stays honest: once a second campaign lands, "no second campaign yet"
// would be false, so it's shown only while models.length < 2 rather than unconditionally.
const emptyState = (board, show) => {
  if (!show || !board.emptyState) return ''
  return `<div class="cell">
      <h3>${esc(board.emptyState.title)}</h3>
      <p>${rich(board.emptyState.body)}</p>
    </div>`
}

const active = (models, board) => [
  '<section>',
  '<h2 class="sec">Active</h2>',
  `<div class="grid2">${models.map(card).join('\n      ')}</div>`,
  emptyState(board, models.length < 2),
  '</section>',
].filter(Boolean).join('\n')

// ---------- What a campaign owns, and what it borrows ----------

const ownership = (board) => {
  const o = board.ownership
  if (!o) return ''
  // The hand-written page colored owned vs. shared paths differently (`td.p` vs `td.p.shared`),
  // a distinction theme.mjs's tables don't carry. `td.ref` (the mono/specimen-colored path style
  // every other table on the site uses) stands in for both; the Scope column text still says
  // which is which, so nothing said on the page is lost — only that one color cue.
  const rows = o.rows.map((r) => `<tr><td class="ref">${esc(r.path)}</td><td>${rich(r.scope)}</td></tr>`).join('\n          ')
  return `<section>
    <h2 class="sec">What a campaign owns, and what it borrows</h2>
    <p class="lede">${rich(o.lede)}</p>
    <div class="tw">
      <table>
        <thead><tr><th>Path</th><th>Scope</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </section>`
}

// ---------- Shared language ----------

const sharedLanguage = (board) => {
  const s = board.sharedLanguage
  if (!s) return ''
  const terms = s.terms.map((t) => `<div class="cell"><h3>${esc(t.name)}</h3><p>${rich(t.body)}</p></div>`).join('\n      ')
  return `<section>
    <h2 class="sec">Shared language</h2>
    <p class="lede">${rich(s.lede)}</p>
    <div class="grid2">
      ${terms}
    </div>
  </section>`
}

// ---------- masthead, footer ----------

const masthead = (board) => `<header class="mast">
    <p class="kick">githubhy/study-harness · one campaign per subject</p>
    <h1>Campaign Board</h1>
    <p class="sf">${rich(board.standfirst)}</p>
  </header>`

const footer = () => `<footer>
    <span>map · CONTEXT-MAP.md</span>
    <span>method · docs/adr/0001</span>
    <span>conventions · docs/agents/</span>
    <span>this page · campaigns/index.html</span>
  </footer>`

export function renderBoard(models, board) {
  return [
    '<meta charset="utf-8">',
    GENERATED_MARKER,
    '<title>Campaign Board</title>',
    CSS,
    '<div class="page"><main>',
    masthead(board),
    active(models, board),
    ownership(board),
    sharedLanguage(board),
    footer(),
    '</main></div>',
  ].filter(Boolean).join('\n')
}
