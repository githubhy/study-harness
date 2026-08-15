import { CSS } from './theme.mjs'
import { esc, rich, attr, code } from './html.mjs'

// ---------- small shared helpers ----------

const NUM_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]
const spell = (n) => NUM_WORDS[n] ?? String(n)
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const byLetter = (a, b) => (a.letter < b.letter ? -1 : a.letter > b.letter ? 1 : 0)

const joinAnd = (arr) => {
  if (arr.length <= 1) return arr.join('')
  return `${arr.slice(0, -1).join(', ')} and ${arr.at(-1)}`
}

const threadsByLoop = (threads, loopId) => threads.filter((t) => t.loop === loopId).sort(byLetter)
const sumPackages = (threads) => threads.reduce((s, t) => s + t.packages.length, 0)

const needsLabel = (needs) => (needs === 'capture' ? 'capture' : needs === 'note-2.0' ? 'note 2.0' : 'source')
const needsColor = (needs) => (needs === 'source' ? 'var(--go)' : 'var(--control)')
const needsBadge = (needs) => (needs === 'capture' ? 'needs a dsh capture' : needs === 'note-2.0' ? 'needs note 2.0' : '')
const dataNeed = (needs) => (needs === 'source' ? 'source' : 'capture')

const splitByNeeds = (threads) => ({
  source: threads.filter((t) => t.needs === 'source'),
  evidence: threads.filter((t) => t.needs !== 'source'),
})

const evidenceClause = (evidence) => {
  const groups = {}
  for (const t of evidence) (groups[t.needs] ??= []).push(t.letter)
  const parts = []
  if (groups.capture) parts.push(`${joinAnd(groups.capture)} need${groups.capture.length === 1 ? 's' : ''} a dsh capture`)
  if (groups['note-2.0']) parts.push(`${joinAnd(groups['note-2.0'])} need${groups['note-2.0'].length === 1 ? 's' : ''} note 2.0`)
  return parts.join(', ')
}

// What the masthead and §8's heading assert is how many packages the specimen actually has — the
// checkable claim §8's `gh api` command re-verifies. Counting the tokens the threads happen to list
// would instead assert "everything we listed is listed", which is circular, and diverges anyway
// because the lists use globs (`compaction/*`) and sub-paths (`core/agent`, `core/agent-loop`).
// specimen.packageCount is that claim; the derived count is the fallback when none is stated.
const packageTotal = (data, census, infra) =>
  data.specimen.packageCount ?? new Set([...census.flatMap((c) => c.packages), ...infra]).size

// ---------- §1 the loop: fixed SVG diagram ----------

const LOOP_SVG = `<figure class="loop">
      <svg viewBox="0 0 900 168" role="img" aria-label="The agent loop: assemble context, call model, parse tool calls, execute tools, append results, then repeat until a stop condition fires.">
        <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
        <g style="color:var(--ink-faint)">
          <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12.5" text-anchor="middle">
            <g style="color:var(--ink)" fill="currentColor">
              <rect x="8" y="34" width="150" height="46" fill="none" stroke="currentColor"/><text x="83" y="62">assemble</text>
              <rect x="196" y="34" width="130" height="46" fill="none" stroke="currentColor"/><text x="261" y="62">call model</text>
              <rect x="364" y="34" width="130" height="46" fill="none" stroke="currentColor"/><text x="429" y="62">parse calls</text>
              <rect x="532" y="34" width="140" height="46" fill="none" stroke="currentColor"/><text x="602" y="62">execute</text>
              <rect x="710" y="34" width="140" height="46" fill="none" stroke="currentColor"/><text x="780" y="62">append</text>
            </g>
            <g stroke="currentColor" stroke-width="1.25" fill="none" marker-end="url(#ar)">
              <path d="M158,57 L190,57"/><path d="M326,57 L358,57"/><path d="M494,57 L526,57"/><path d="M672,57 L704,57"/>
            </g>
            <path d="M780,80 L780,124 L83,124 L83,86" stroke="currentColor" stroke-width="1.25" fill="none" stroke-dasharray="4 4" marker-end="url(#ar)"/>
            <text x="431" y="142" fill="currentColor">repeat until a stop condition fires</text>
          </g>
        </g>
      </svg>
      <figcaption>Five phases. Every harness has all of them; they differ in what they do at each.</figcaption>
    </figure>`

const sLoop = (data) => {
  const lede = data.copy.sections.s1 ? `<p class="lede">${rich(data.copy.sections.s1)}</p>` : ''
  const claims = data.copy.claims ?? []
  const claimsBlock = claims.length
    ? `<h4>${cap(spell(claims.length))} claims the whole plan rests on</h4>
    <div class="grid3">
      ${claims.map((c) => `<div class="cell"><h3>${rich(c.title)}</h3><p>${rich(c.body)}</p></div>`).join('\n      ')}
    </div>`
    : ''
  // Original spacing was asymmetric — a single line between the lede and the fixed loop figure,
  // a blank line before the (optional) claims block — so that's preserved here rather than
  // uniformly double-spacing every joint.
  const top = [lede, LOOP_SVG].filter(Boolean).join('\n    ')
  const body = [top, claimsBlock].filter(Boolean).join('\n\n    ')
  return `<section id="s1">
    <span class="snum">§ 1</span>
    <h2 class="sec">The loop everything else is filed under</h2>
    ${body}
  </section>`
}

// ---------- §2 the map: campaign-specific narrative from copy.map, data-driven stagerow ----------

const NODEBOX_KIND_CLASS = { plain: '', control: ' ctl', observe: ' obs' }

const renderNodebox = (node) => `<div class="nodebox${NODEBOX_KIND_CLASS[node.kind] ?? ''}">
        <div class="n-id">${esc(node.id)}</div>
        <div class="n-t">${rich(node.title)}</div>
        <div class="n-s">${rich(node.sub)}</div>
      </div>`

const renderOutput = (o) => `<div class="out">
          <div class="n-id">${esc(o.id)}</div>
          <div class="n-t">${rich(o.title)}</div>
          <div class="n-s">${rich(o.sub)}</div>
        </div>`

const sMap = (data) => {
  const map = data.copy.map ?? {}
  const lede = map.lede ? `<p class="lede">${rich(map.lede)}</p>` : ''
  const chain = map.chain ?? []
  const links = map.links ?? []
  const outputs = map.outputs ?? []

  const chainHtml = chain.map((node, i) => {
    const link = links[i] ? `<div class="link"><i></i><span>${rich(links[i])}</span><i></i><u></u></div>` : ''
    return `${renderNodebox(node)}\n      ${link}`
  }).join('\n\n      ')

  const stagecells = data.loopSteps
    .map((s) => {
      const members = threadsByLoop(data.threads, s.id)
      return `<a class="stagecell" href="#${attr(s.id)}"><span class="st-n">${esc(s.label)}</span><span class="st-c">${members.length}</span><span class="st-l">${esc(members.map((t) => t.letter).join(' · '))}</span></a>`
    })
    .join('\n          ')

  const outputsHtml = outputs.map(renderOutput).join('\n        ')

  const figure = chain.length
    ? `<figure class="schema">
      ${chainHtml}

      <div class="fan">
        <div class="fan-bar"></div>
        <div class="stagerow">
          ${stagecells}
        </div>
      </div>

      <div class="link"><i></i><u></u></div>
      <div class="outs">
        ${outputsHtml}
      </div>

      ${map.caption ? `<figcaption>${rich(map.caption)}</figcaption>` : ''}
    </figure>`
    : ''

  const body = [lede, figure].filter(Boolean).join('\n\n    ')
  return `<section id="s2">
    <span class="snum">§ 2</span>
    <h2 class="sec">The map · what blocks what</h2>
    ${body}
  </section>`
}

// ---------- §3 the board: 4 lanes of phase cards, NO state chips ----------

const LANES = {
  ready: { dataS: 'go', title: 'Ready now', sub: 'Nothing blocks these. No API key required.' },
  next: { dataS: 'next', title: 'Unlocked by Phase 0', sub: 'The control, then the blind baseline. In that order.' },
  gate: { dataS: 'gate', title: 'Gated on a finding', sub: 'Not gated on a phase — gated on one specific thread landing.' },
  last: { dataS: 'last', title: 'Last by design', sub: "Doing this early doesn't speed the study up — it invalidates it." },
}
const LANE_ORDER = ['ready', 'next', 'gate', 'last']

const renderHalt = (halt) => {
  if (!halt) return ''
  const pre = halt.pre ? `<pre>${code(halt.pre)}</pre>` : ''
  const body = halt.body ? `<p>${rich(halt.body)}</p>` : ''
  const inner = [pre, body].filter(Boolean).join('\n            ')
  return `<div class="halt">
            <div class="h-t">${esc(halt.title ?? 'The one check you must not skip')}</div>
            ${inner}
          </div>`
}

const renderBlocks = (phase) => {
  const lines = []
  if (phase.blocks) {
    const cls = phase.blocks.toLowerCase() === 'nothing' ? 'no' : 'yes'
    // `note` carries its own leading separator because the source uses different ones
    // (" · uses the DeepSeek key" vs " — it does not wait for the other fourteen").
    const note = phase.note ? ` ${rich(phase.note)}` : ''
    lines.push(`blocked by <b class="${cls}">${esc(phase.blocks)}</b>${note}`)
  }
  if (phase.produces?.length) lines.push(`produces ${phase.produces.map((p) => `<b>${esc(p)}</b>`).join(' · ')}`)
  if (phase.unblocks) lines.push(`unblocks <b>${esc(phase.unblocks)}</b>`)
  if (phase.consumes) lines.push(`consumes <b>${esc(phase.consumes)}</b>`)
  return lines.join('<br>')
}

// A phase detail entry is a prose string (a card paragraph), { bullets: [...] } (a <ul>), or
// { pre: "..." } (a code block). The third shape exists because Phase 3's card interleaves
// prose, a <pre>, and more prose — an order `phases[].pre` alone cannot express.
const renderPhaseDetail = (d) => {
  if (typeof d === 'string') return `<p>${rich(d)}</p>`
  if (d && Array.isArray(d.bullets)) return `<ul>${d.bullets.map((b) => `<li>${rich(b)}</li>`).join('')}</ul>`
  if (d && typeof d.pre === 'string') return `<pre>${code(d.pre)}</pre>`
  return ''
}

const renderCard = (phase) => {
  const dataS = LANES[phase.lane]?.dataS ?? 'go'
  const pre = phase.pre ? `<pre>${code(phase.pre)}</pre>` : ''
  const details = (phase.detail ?? []).map(renderPhaseDetail).join('\n          ')
  const body = [`<p>${rich(phase.body)}</p>`, pre, renderHalt(phase.halt), details]
    .filter(Boolean).join('\n          ')
  return `<article class="card" data-s="${attr(dataS)}">
          <div class="c-top"><span class="c-id">${esc(phase.id)}</span></div>
          <div class="c-t">${esc(phase.title)}</div>
          ${body}
          <div class="c-blocks">${renderBlocks(phase)}</div>
        </article>`
}

const sBoard = (data) => {
  const lede = `<p class="lede">
      The same five phases as the map, sorted by <strong>what is blocking each card</strong> rather than by phase number.
      The left lane needs nothing but a terminal; the right lane must stay last or the study invalidates itself.
    </p>`
  const lanes = LANE_ORDER.map((key) => {
    const phases = data.phases.filter((p) => p.lane === key)
    if (!phases.length) return ''
    const meta = LANES[key]
    return `<div class="lane" data-s="${attr(meta.dataS)}">
        <div class="lane-h">
          <div class="lane-t"><span>${esc(meta.title)}</span><span>${phases.length}</span></div>
          <div class="lane-s">${esc(meta.sub)}</div>
        </div>

        ${phases.map(renderCard).join('\n\n        ')}
      </div>`
  }).filter(Boolean).join('\n\n      ')

  return `<section id="s3">
    <span class="snum">§ 3</span>
    <h2 class="sec">The board · what you can start now</h2>
    ${lede}

    <div class="board">

      ${lanes}

    </div>
  </section>`
}

// ---------- §4 the menu: five loop bands, thread cards ----------

// A detail entry is either a prose string (rendered as a paragraph) or an object
// { bullets: [...] } (rendered as a <ul>), per the schema addition covering thread O's list.
const renderDetail = (d) => {
  if (typeof d === 'string') return `<p class="d">${rich(d)}</p>`
  if (d && Array.isArray(d.bullets)) return `<ul>${d.bullets.map((b) => `<li>${rich(b)}</li>`).join('')}</ul>`
  return ''
}

// A toy shortcut may raise more than one thread, and a thread may be raised by more than one
// shortcut — D and A each appear in two rows of the source's question index. questionIndex models
// that many-to-many relation directly; a card's FROM line is every entry naming its letter, in
// index order, so the two directions cannot drift apart.
//
// An entry carries the wording for both surfaces because the source deliberately sets them
// differently: §5's table is sentence case with inline <code> (it indexes code constructs), the
// cards run it as lowercase prose inside an already-monospaced line. The two strings sit adjacent
// in one object, so neither can drift from the other the way two separate homes would.
const fromWordingFor = (data, letter) =>
  (data.questionIndex ?? []).filter((e) => e.threads.includes(letter)).map((e) => e.from)

const renderThreadCard = (t, data) => {
  const tags = [
    ...t.packages.map((p) => `<span class="pkg">${esc(p)}</span>`),
    needsBadge(t.needs) ? `<span class="tag t-cap">${esc(needsBadge(t.needs))}</span>` : '',
    t.gates ? `<span class="tag t-gate">gates ${esc(t.gates)}</span>` : '',
    t.comparison ? '<span class="tag t-cc">CC comparison</span>' : '',
  ].filter(Boolean).join('')

  const details = (t.detail ?? []).map(renderDetail).join('\n          ')
  const fromCls = t.raisedBy.kind === 'census' ? ' census' : ''
  // Five thread cards open on reading rather than on a command, so `entry` is nullable and an
  // absent one emits nothing rather than an empty <pre> box.
  const entry = t.entry ? `<pre>${code(t.entry)}</pre>` : ''
  // A census-raised thread has no questionIndex entry by definition — the toy never raised it — so
  // raisedBy.text carries its FROM line. A toy-raised thread derives its line instead, which is why
  // raisedBy.text is absent on those: one string, one home.
  const from = t.raisedBy.kind === 'census'
    ? `<b>${rich(t.raisedBy.text)}</b>`
    : fromWordingFor(data, t.letter).map((s) => `<b>${rich(s)}</b>`).join(' · ')

  return `<article class="thread" data-need="${attr(dataNeed(t.needs))}" id="t${attr(t.letter)}">
          <div class="t-top"><span class="letter">${esc(t.letter)}</span><span class="t-name">${esc(t.name)}</span></div>
          <p class="t-q">${rich(t.question)}</p>
          <p class="t-from${fromCls}">FROM ${from}</p>
          <div class="tags">${tags}</div>
          ${entry}
          ${details}
          <p class="t-from">→ <a href="worklog.html#t${attr(t.letter)}">worklog</a></p>
        </article>`
}

const sMenu = (data, derived) => {
  void derived
  const lede = data.copy.sections.s4 ? `<p class="lede">${rich(data.copy.sections.s4)}</p>` : ''
  const { source, evidence } = splitByNeeds(data.threads)
  const legend = `<div class="legend">
      <span><b class="k1">■</b> open the moment Phase 1 lands · source only · <b>${source.length}</b></span>
      <span><b class="k2">■</b> waits on evidence · <b>${evidence.length}</b>${evidence.length ? ` — ${esc(evidenceClause(evidence))}` : ''}</span>
    </div>`

  const bands = data.loopSteps.map((s) => {
    const members = threadsByLoop(data.threads, s.id)
    const bodyCls = members.length > 1 ? ' two' : ''
    return `<div class="band" id="${attr(s.id)}">
      <div class="band-head">
        <span class="band-step">${esc(s.step)} · ${esc(s.label)}</span>
        <span class="band-q">${rich(s.question)}</span>
        <span class="band-n">${members.length} thread${members.length === 1 ? '' : 's'} · ${sumPackages(members)} packages</span>
      </div>
      <div class="band-body${bodyCls}">
        ${members.map((t) => renderThreadCard(t, data)).join('\n\n        ')}
      </div>
    </div>`
  }).join('\n\n    ')

  const top = [lede, legend].filter(Boolean).join('\n    ')
  return `<section id="s4">
    <span class="snum">§ 4</span>
    <h2 class="sec">The menu · ${spell(data.threads.length)} threads</h2>
    ${top}

    ${bands}
  </section>`
}

// ---------- §5 the question index: from data.questionIndex ----------

const sWhy = (data) => {
  const lede = data.copy.sections.s5 ? `<p class="lede">${rich(data.copy.sections.s5)}</p>` : ''

  // One row per questionIndex entry, in the order the entries are written. The relation is
  // many-to-many in both directions — a shortcut can raise several threads ("two tools in an array
  // literal" raises D and A) and a thread can be raised by several shortcuts (D again, plus
  // "running every tool unchecked") — so it is modelled as its own list rather than inferred by
  // grouping one field on the threads, which could only ever express one direction.
  //
  // `shortcut` goes through rich() so the column keeps its inline <code>: this is the table that
  // indexes code constructs, and MAX_STEPS = 10 set as prose reads as a different claim.
  const toyRows = (data.questionIndex ?? []).map((e) =>
    `<tr><td>${rich(e.shortcut)}</td><td>${rich(e.question)}</td><td class="ref">${esc(e.threads.join(' · '))}</td></tr>`
  ).join('\n          ')

  const census = data.threads.filter((t) => t.raisedBy.kind === 'census')

  let censusRow = ''
  if (census.length) {
    const letters = census.map((t) => t.letter)
    const label = letters.length === 1 ? `Thread ${letters[0]}` : `Threads ${joinAnd(letters)}`
    const pronoun = letters.length === 1 ? 'it' : 'them'
    censusRow = `<tr><td colspan="2" style="color:var(--ink-faint)">${esc(label)} came from the package census in §8 instead — the toy could not have suggested ${pronoun}.</td><td class="ref" style="color:var(--ink-faint)">${esc(letters.join(' · '))}</td></tr>`
  }

  const rows = [toyRows, censusRow].filter(Boolean).join('\n          ')
  const table = `<div class="tw">
      <table>
        <thead><tr><th>What the toy does</th><th>The question it raises</th><th>Thread</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`
  const body = [lede, table].filter(Boolean).join('\n    ')
  return `<section id="s5">
    <span class="snum">§ 5</span>
    <h2 class="sec">Why these ${spell(data.threads.length)}</h2>
    ${body}
  </section>`
}

// ---------- §6 the transfer ledger ----------

const sTransfer = (data) => {
  const lede = data.copy.sections.s6 ? `<p class="lede">${rich(data.copy.sections.s6)}</p>` : ''
  const rows = (data.transferLedger ?? []).map((r) =>
    `<tr><td>${rich(r.q)}</td><td class="${r.available ? 'y' : 'n'}">${r.available ? 'yes' : 'no'}</td><td>${rich(r.source)}</td></tr>`
  ).join('\n          ')

  const table = `<div class="tw">
      <table>
        <thead><tr><th>Question</th><th>In transcripts?</th><th>Where it comes from</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`
  const pull = data.copy.transferPull ? `<p class="pull">${rich(data.copy.transferPull)}</p>` : ''
  const body = [lede, table, pull].filter(Boolean).join('\n    ')
  return `<section id="s6">
    <span class="snum">§ 6</span>
    <h2 class="sec">What the transfer test can and can't see</h2>
    ${body}
  </section>`
}

// ---------- §7 standing orders ----------

// A standing order's body may carry this literal token where the canonical task quote belongs
// (matching the source's <em>"…"</em> quoting), so the task text lives once — in canonicalTask —
// rather than being hand-duplicated into the order's authored prose.
const CANONICAL_TASK_TOKEN = '{{canonicalTask}}'

const sOrders = (data) => {
  const orders = data.copy.standingOrders ?? []
  const lede = orders.length
    ? `<p class="lede">${cap(spell(orders.length))} rules that hold in every phase and every thread. Read them once; they are assumed everywhere above.</p>`
    : ''
  const cellBody = (o) => {
    const body = rich(o.body)
    return body.includes(CANONICAL_TASK_TOKEN)
      ? body.replaceAll(CANONICAL_TASK_TOKEN, `<em>"${rich(data.canonicalTask)}"</em>`)
      : body
  }
  const grid = orders.length
    ? `<div class="grid2">
      ${orders.map((o) => `<div class="cell"><h3>${rich(o.title)}</h3><p>${cellBody(o)}</p></div>`).join('\n      ')}
    </div>`
    : ''

  const sectionBody = [lede, grid].filter(Boolean).join('\n    ')
  return `<section id="s7">
    <span class="snum">§ 7</span>
    <h2 class="sec">Standing orders</h2>
    ${sectionBody}
  </section>`
}

// ---------- §8 the package census ----------

const sCensus = (derived, data) => {
  const total = packageTotal(data, derived.census, data.infrastructurePackages ?? [])
  // Grouped by loop step (same ordering nav, §2, and §4 use), not sorted flat by letter — that's
  // what makes the "Loop step" column mean anything instead of just repeating per row.
  const rows = data.loopSteps.flatMap((s) => threadsByLoop(derived.census, s.id)).map((c) =>
    `<tr><td class="mono">${esc(c.loop)}</td><td class="ref">${esc(c.letter)} · ${esc(c.name)}</td><td class="mono" style="color:${needsColor(c.needs)}">${esc(needsLabel(c.needs))}</td><td class="mono">${esc(c.packages.join(' · '))}</td></tr>`
  ).join('\n          ')

  const infra = data.infrastructurePackages ?? []
  const infraRow = infra.length
    ? `<tr><td class="mono" style="color:var(--ink-faint)">—</td><td class="ref" style="color:var(--ink-faint)">infrastructure</td><td class="mono" style="color:var(--ink-faint)">—</td><td class="mono">${esc(infra.join(' · '))}</td></tr>`
    : ''

  const recheck = data.specimen.repo
    ? `<h4>Re-run after any upstream bump</h4>
    <pre>${esc(`gh api repos/${data.specimen.repo}/contents/packages \\
  --jq '.[] | select(.type=="dir") | .name' | sort > /tmp/pkgs.txt
while read -r p; do rg -q "$p" campaigns/${data.campaign}/roadmap.html \\
  || echo "UNCOVERED: $p"; done < /tmp/pkgs.txt`)}</pre>`
    : ''

  const tbodyRows = [rows, infraRow].filter(Boolean).join('\n          ')
  const table = `<div class="tw">
      <table>
        <thead><tr><th>Loop step</th><th>Thread</th><th>Needs</th><th>Packages</th></tr></thead>
        <tbody>
          ${tbodyRows}
        </tbody>
      </table>
    </div>`
  const sectionBody = [
    `<p class="lede">Breadth is checkable, not claimed. If a package isn't listed, that's a gap in the plan — add a thread rather than skipping it.</p>`,
    table,
    recheck,
  ].filter(Boolean).join('\n    ')
  return `<section id="s8">
    <span class="snum">§ 8</span>
    <h2 class="sec">Package census · all ${total} accounted for</h2>
    ${sectionBody}
  </section>`
}

// ---------- nav, masthead, footer ----------

const NAV_SECTIONS = [
  ['s1', '1', 'The loop'],
  ['s2', '2', 'The map'],
  ['s3', '3', 'The board'],
  ['s4', '4', 'The menu'],
  ['s6', '6', 'Transfer test'],
  ['s7', '7', 'Standing orders'],
  ['s8', '8', 'Census'],
]

const nav = (data) => {
  const sectionItems = [
    ...NAV_SECTIONS.slice(0, 4).map(([id, n, label]) => `<li><a href="#${id}"><b>${n}</b><span>${esc(label)}</span></a></li>`),
    `<li><a href="#s5"><b>5</b><span>Why these ${data.threads.length}</span></a></li>`,
    ...NAV_SECTIONS.slice(4).map(([id, n, label]) => `<li><a href="#${id}"><b>${n}</b><span>${esc(label)}</span></a></li>`),
  ].join('\n    ')

  const groups = data.loopSteps.map((s) => {
    const members = threadsByLoop(data.threads, s.id)
    if (!members.length) return ''
    const items = members.map((t) => {
      const capCls = t.needs !== 'source' ? ' class="cap"' : ''
      return `<li><a href="#t${attr(t.letter)}"${capCls}><b>${esc(t.letter)}</b><span>${esc(t.name)}</span></a></li>`
    }).join('\n      ')
    return `<h2>${esc(s.label)}</h2>
    <ol>
      ${items}
    </ol>`
  }).filter(Boolean).join('\n    ')

  return `<nav aria-label="Contents">
  <h2>Sections</h2>
  <ol>
    ${sectionItems}
  </ol>
  ${groups}
</nav>`
}

const masthead = (data, derived) => {
  const { source, evidence } = splitByNeeds(data.threads)
  const packages = packageTotal(data, derived.census, data.infrastructurePackages ?? [])

  return `<header class="mast">
    <p class="kick">Campaign <b style="color:var(--ink-soft);font-weight:500">${esc(data.campaign)}</b> · ${esc(data.specimen.short ?? data.specimen.name)} @ ${esc(data.specimen.pinned)} · nothing on this page is hidden</p>
    <h1>${esc(data.title)}</h1>
    <p class="sf">${rich(data.copy.standfirst)}</p>
    <div class="facts">
      <span>specimen <b>${esc(data.specimen.name)}</b></span>
      <span>pinned <b>${esc(data.specimen.pinned)}</b> · ${esc(data.specimen.date)}</span>
      <span>packages <b>${packages}</b>, all covered</span>
      <span>threads <b>${data.threads.length}</b> — ${source.length} open, ${evidence.length} need evidence</span>
      <span>transfer test <b>${esc(data.transferSpecimen.name)} ${esc(data.transferSpecimen.via)}</b></span>
      <span>completion <b>none — surprise budget</b></span>
    </div>
  </header>`
}

const footer = (data) => `<footer>
    <span><a href="../index.html">← all campaigns</a></span>
    <span>campaign · ${esc(data.campaign)}</span>
    <span>plan · plan.md</span>
    <span>glossary · CONTEXT.md</span>
    <span>method · docs/adr/0001 (repo-wide)</span>
    <span><a href="worklog.html">→ worklog</a></span>
  </footer>`

export function renderRoadmap({ data, derived }) {
  return [
    '<meta charset="utf-8">',
    `<title>${esc(data.title)}</title>`,
    CSS,
    '<div class="page"><div class="cols">',
    nav(data), '<main>',
    masthead(data, derived),
    sLoop(data), sMap(data), sBoard(data), sMenu(data, derived),
    sWhy(data), sTransfer(data), sOrders(data), sCensus(derived, data),
    footer(data),
    '</main></div></div>',
  ].filter(Boolean).join('\n')
}
