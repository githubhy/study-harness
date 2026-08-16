import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LETTERS = 'ABCDEFGHIJKLMNO'

// Every path this generator touches is resolved against the repo root — the directory holding
// `tools/` and `campaigns/` — rather than against the cwd. Run from anywhere else and the cwd
// form threw an uncaught ENOENT on `campaigns`; the tool's location is what fixes its data's
// location, not where the shell happens to be sitting.
export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const fromRoot = (...parts) => resolve(ROOT, ...parts)

// `override` exists so tests can validate mutated data without writing files.
export function readCampaign(dir, override) {
  const shown = join(dir, 'campaign.json')
  const fail = (msg) => { throw new Error(`${shown}: ${msg}`) }

  // JSON.parse reports a byte offset and no filename, so under `--all` a malformed file could not
  // say which campaign it was. Both failure modes go through fail() so the path is always named.
  const read = () => {
    let raw
    try {
      raw = readFileSync(fromRoot(dir, 'campaign.json'), 'utf8')
    } catch (err) {
      fail(err.code === 'ENOENT' ? 'does not exist' : `could not be read: ${err.message}`)
    }
    try {
      return JSON.parse(raw)
    } catch (err) {
      fail(`is not valid JSON: ${err.message}`)
    }
  }

  const data = override ?? read()

  if (!Array.isArray(data.loopSteps)) fail('loopSteps is not an array')
  if (!Array.isArray(data.threads)) fail('threads is not an array')
  if (!Array.isArray(data.log)) fail('log is not an array')
  if (!Array.isArray(data.phases)) fail('phases is not an array')

  // The surprise budget is the campaign's central mechanic: it sizes every pip string and decides
  // when a thread goes dry. Unvalidated, an absent or non-numeric one fails silently rather than
  // loudly — Math.min(run, undefined) is NaN, so every thread renders an empty pip string, and
  // run >= undefined is always false, so nothing ever goes dry.
  if (!Number.isInteger(data.surpriseBudget) || data.surpriseBudget < 1)
    fail(`surpriseBudget ${JSON.stringify(data.surpriseBudget) ?? 'undefined'} is not a positive integer`)

  const loops = new Set(data.loopSteps.map((s) => s.id))
  const phases = new Set(data.phases.map((p) => p.id))
  const seen = new Set()
  for (const t of data.threads) {
    if (!LETTERS.includes(t.letter) || t.letter.length !== 1) fail(`thread letter ${t.letter} is not in A-O`)
    if (seen.has(t.letter)) fail(`duplicate thread letter ${t.letter}`)
    seen.add(t.letter)
    if (!loops.has(t.loop)) fail(`thread ${t.letter} names unknown loop step ${t.loop}`)
    if (t.gates !== null && !phases.has(t.gates)) fail(`thread ${t.letter} gates ${t.gates} is not a known phase`)
    // Every thread card reads raisedBy.kind to choose which FROM line to render, and a census-raised
    // one reads raisedBy.text as that line. Missing either is a raw TypeError deep inside the
    // renderer otherwise, naming neither the thread nor the file.
    if (t.raisedBy?.kind !== 'toy' && t.raisedBy?.kind !== 'census')
      fail(`thread ${t.letter} raisedBy.kind is ${JSON.stringify(t.raisedBy?.kind) ?? 'undefined'}, not "toy" or "census"`)
    if (t.raisedBy.kind === 'census' && typeof t.raisedBy.text !== 'string')
      fail(`thread ${t.letter} is census-raised but carries no raisedBy.text`)
  }

  // questionIndex drives §5's rows and every toy thread's FROM line, so a letter that names no
  // thread would silently emit a row pointing at nothing.
  const raisedLetters = new Set()
  ;(data.questionIndex ?? []).forEach((e, i) => {
    for (const l of e.threads) {
      if (!seen.has(l)) fail(`questionIndex[${i}] names unknown thread ${l}`)
      raisedLetters.add(l)
    }
  })

  // And the reverse: a toy-raised thread named by no entry has nothing to derive its FROM line
  // from, so it would render "FROM " — an empty line, silently. Census-raised threads are exempt
  // by definition; they carry raisedBy.text instead.
  for (const t of data.threads)
    if (t.raisedBy?.kind === 'toy' && !raisedLetters.has(t.letter))
      fail(`thread ${t.letter} is toy-raised but no questionIndex entry names it`)

  // Appending a log entry is the only hand edit in the documented update loop, which makes an
  // omitted `opened` or `resolved` the likeliest hand-edit error in the system. Both are read
  // below to build openedIds, before the per-entry pass, so the shape is checked first — otherwise
  // the failure is "e.opened is not iterable", naming neither the entry nor the file.
  data.log.forEach((e, i) => {
    if (!Array.isArray(e.opened)) fail(`log[${i}].opened is not an array`)
    if (!Array.isArray(e.resolved)) fail(`log[${i}].resolved is not an array`)
  })

  const openedIds = new Set()
  for (const e of data.log) for (const o of e.opened) openedIds.add(o.id)

  data.log.forEach((e, i) => {
    if (!seen.has(e.thread)) fail(`log[${i}].thread ${e.thread} is not a known thread`)
    if (Number.isNaN(Date.parse(e.date))) fail(`log[${i}].date ${e.date} is not a parseable date`)
    if (!existsSync(fromRoot(dir, e.note))) fail(`log[${i}].note ${e.note} does not exist`)
    for (const o of e.opened)
      if (!seen.has(o.ask)) fail(`log[${i}] opened "${o.id}" asks unknown thread ${o.ask}`)
    for (const id of e.resolved)
      if (!openedIds.has(id)) fail(`log[${i}] resolves "${id}", which was never opened`)
  })

  // A phase's writeup is the report it produced, and the only evidence in this data that the phase
  // has actually landed — §3 derives its state from nothing else. So the href has to resolve to a
  // real note source, not just be a plausible string: the pages it names are generated, and a typo
  // in one would otherwise render a phase as done and link it to a 404.
  data.phases.forEach((p, i) => {
    for (const w of writeups(p)) {
      if (typeof w.href !== 'string' || typeof w.label !== 'string')
        fail(`phases[${i}].writeup needs a string href and label`)
      const source = w.href.replace(/\.html$/, '.md')
      if (!existsSync(fromRoot(dir, source))) fail(`phases[${i}].writeup ${w.href} has no source at ${source}`)
    }
  })

  return { ...data, dir }
}

/** `writeup` is one report or several — Phase 4 wrote its predictions and its scoring separately. */
export const writeups = (phase) =>
  phase.writeup == null ? [] : Array.isArray(phase.writeup) ? phase.writeup : [phase.writeup]

const pipsFor = (run, budget) => '●'.repeat(Math.min(run, budget)) + '○'.repeat(Math.max(budget - run, 0))

// Thread letters are validated on read as single characters from A-O, so code-unit order is
// alphabetical order. Stated once, here, rather than assumed three times.
const byLetter = (a, b) => (a.letter < b.letter ? -1 : a.letter > b.letter ? 1 : 0)

export function derive(data) {
  const budget = data.surpriseBudget
  const byDate = [...data.log].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))

  const threads = new Map()
  for (const t of data.threads)
    threads.set(t.letter, { ...t, state: 'not-started', run: 0, pips: pipsFor(0, budget), entries: [], issue: null, lastDate: null })

  const trail = []
  for (const e of byDate) {
    const t = threads.get(e.thread)
    t.run = e.surprising ? 0 : t.run + 1
    t.lastDate = e.date
    if (e.issue != null) t.issue = e.issue
    // The entry's own anchor. Thread plus date is not unique — two findings on one thread on one day
    // collide — so it carries its position in its own thread's history, counted from the oldest, and
    // appending a finding never renumbers what is already published. Derived here rather than in the
    // worklog because the thread graph now links to these anchors too, and an id invented separately
    // in two renderers is an id that will eventually disagree with itself.
    const stamped = { ...e, pips: pipsFor(t.run, budget), entryId: `e-${e.thread}${e.date}-${t.entries.length}` }
    t.entries.push(stamped)
    trail.push(stamped)
  }

  for (const t of threads.values()) {
    if (t.entries.length === 0) continue
    t.state = t.run >= budget ? 'dry' : 'live'
    t.pips = pipsFor(t.run, budget)
  }

  const resolved = new Set(byDate.flatMap((e) => e.resolved))
  const frontier = byDate.flatMap((e) => e.opened.map((o) => ({ ...o, from: e.thread, date: e.date })))
    .filter((o) => !resolved.has(o.id))

  // Every question by id, so an entry that resolves one can say which. Without it the graph is
  // only half visible on the page: opening a question renders, closing one silently removes it
  // from the frontier and is never shown to have happened. Validation above already guarantees
  // every resolved id was opened somewhere, so a lookup here cannot miss.
  const questions = new Map(byDate.flatMap((e) => e.opened.map((o) => [o.id, { ...o, from: e.thread }])))

  // Which finding closed which question. An edge on the thread graph is a question, and the useful
  // thing to do with one is to go and read the answer — so the graph needs to know where the answer
  // landed, not just that it did.
  // `trail` rather than `byDate`: only the stamped copies carry entryId, and it is still oldest-first
  // here — the reverse for display happens in the return below.
  const answeredBy = new Map()
  for (const e of trail) for (const id of e.resolved) answeredBy.set(id, e.entryId)

  const edges = [
    // The id travels with the edge so a renderer can tell an answered question from a standing one
    // without re-deriving the frontier for itself.
    ...byDate.flatMap((e) => e.opened.map((o) => ({ from: e.thread, to: o.ask, label: o.q, id: o.id, kind: 'opened' }))),
    ...data.threads.filter((t) => t.gates).map((t) => ({ from: t.letter, to: t.gates, label: 'gates', kind: 'gates' })),
  ]

  // The one band ordering. §4's thread bands, §8's census rows, the contents rail, §2's stagerow,
  // the worklog's coverage strip, and the thread graph all have to agree — the spec makes "same
  // order as the roadmap's §4 bands" a requirement — and each renderer used to group and sort for
  // itself, across two different comparators. They agreed only because thread letters happen to be
  // single uppercase characters: a property of this campaign's data, not of the code.
  // A band carries the loop step and its letters in order — an ordering, not a second copy of the
  // threads. Each renderer maps the letters onto whatever it draws (data.threads for §4's cards,
  // derived.threads for the strip's pips, derived.census for §8's rows), so there is one order and
  // still one home for the content.
  const bands = data.loopSteps.map((s) => ({
    ...s,
    letters: data.threads.filter((t) => t.loop === s.id).sort(byLetter).map((t) => t.letter),
  }))

  // Where a thread's own note lives, so prose that says "Thread D" can link to it. A thread's
  // findings get written into several notes (D's landed in D, G, 03 and C), but exactly one of
  // them is the thread's own — the file whose name starts with its letter. Taking it from the log
  // rather than from a directory listing means the map is built from the same committed data that
  // already had to name an existing file, and a thread with no note of its own simply has no entry
  // rather than a link to a file nobody wrote.
  const noteFor = new Map()
  for (const e of byDate) {
    const base = e.note.split('/').pop()
    if (base.startsWith(`${e.thread}-`) && !noteFor.has(e.thread)) noteFor.set(e.thread, base.replace(/\.md$/, '.html'))
  }

  // §3's lanes describe what *blocked* each phase, which never changes. Whether the phase has
  // landed is a separate axis, and the only evidence for it in this data is whether the phase
  // produced its report. Deriving it here rather than storing a `done` flag keeps it in the same
  // class as the pips and the frontier: a fact about the record, not a second thing to remember to
  // update. Validation above guarantees every writeup names a note that exists.
  const phases = data.phases.map((p) => ({ ...p, reports: writeups(p), done: writeups(p).length > 0 }))

  // Every note the campaign has written, as one list. All 22 were reachable before this existed —
  // but only from the roadmap, scattered across §3's phase cards and §4's thread cards, with no page
  // anywhere that simply listed them. "How do I read the notes?" had no answer better than "scan the
  // roadmap". Built from data rather than a directory listing, so it cannot include a file the
  // campaign never claims or miss one it does: the reports come from the phases' writeups, the
  // synthesis from its own block, and the thread notes from the log via noteFor.
  const seenHref = new Set()
  const reports = [
    ...data.phases.flatMap(writeups),
    ...(data.synthesis ? [{ href: data.synthesis.href, label: data.synthesis.title }] : []),
  ].filter((w) => !seenHref.has(w.href) && seenHref.add(w.href))

  const noteIndex = {
    reports,
    threads: data.threads.filter((t) => noteFor.has(t.letter)).map((t) => {
      const d = threads.get(t.letter)
      return { letter: t.letter, name: t.name, href: `notes/${noteFor.get(t.letter)}`,
               state: d.state, pips: d.pips, findings: d.entries.length }
    }),
  }

  const list = [...threads.values()]
  return {
    threads,
    bands,
    noteFor,
    noteIndex,
    phases,
    phaseTotals: { done: phases.filter((p) => p.done).length, total: phases.length },
    totals: {
      touched: list.filter((t) => t.state !== 'not-started').length,
      dry: list.filter((t) => t.state === 'dry').length,
      notStarted: list.filter((t) => t.state === 'not-started').length,
    },
    live: list.filter((t) => t.state === 'live')
      .sort((a, b) => Date.parse(b.lastDate) - Date.parse(a.lastDate)).map((t) => t.letter),
    frontier,
    questions,
    answeredBy,
    trail: trail.reverse(),
    // The trail grouped by the thread that produced each entry, in the one band ordering above.
    // Flat chronological order was the wrong axis for this campaign: every entry carries the same
    // date, so the dates sorted nothing and a reader after one thread's findings had to scan all of
    // them. Grouping here rather than in the renderer keeps the ordering decision in one place —
    // the strip, §4 and this list now walk the threads in the same sequence, so a pip and the
    // section it jumps to agree. Entries stay newest-first inside a group.
    trailByThread: bands.flatMap((band) => band.letters
      .map((l) => threads.get(l))
      .filter((t) => t.entries.length > 0)
      .map((t) => ({ letter: t.letter, name: t.name, state: t.state, pips: t.pips, band: band.id,
                     entries: [...t.entries].reverse() }))),
    edges,
    census: data.threads.map(({ letter, name, loop, needs, packages }) => ({ letter, name, loop, needs, packages })),
  }
}

export function loadCampaign(dir) {
  const data = readCampaign(dir)
  return { data, derived: derive(data) }
}
