import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const LETTERS = 'ABCDEFGHIJKLMNO'

// `override` exists so tests can validate mutated data without writing files.
export function readCampaign(dir, override) {
  const data = override ?? JSON.parse(readFileSync(join(dir, 'campaign.json'), 'utf8'))
  const fail = (msg) => { throw new Error(`${dir}/campaign.json: ${msg}`) }

  if (!Array.isArray(data.loopSteps)) fail('loopSteps is not an array')
  if (!Array.isArray(data.threads)) fail('threads is not an array')
  if (!Array.isArray(data.log)) fail('log is not an array')
  if (!Array.isArray(data.phases)) fail('phases is not an array')

  const loops = new Set(data.loopSteps.map((s) => s.id))
  const phases = new Set(data.phases.map((p) => p.id))
  const seen = new Set()
  for (const t of data.threads) {
    if (!LETTERS.includes(t.letter) || t.letter.length !== 1) fail(`thread letter ${t.letter} is not in A-O`)
    if (seen.has(t.letter)) fail(`duplicate thread letter ${t.letter}`)
    seen.add(t.letter)
    if (!loops.has(t.loop)) fail(`thread ${t.letter} names unknown loop step ${t.loop}`)
    if (t.gates !== null && !phases.has(t.gates)) fail(`thread ${t.letter} gates ${t.gates} is not a known phase`)
  }

  // questionIndex drives §5's rows and every toy thread's FROM line, so a letter that names no
  // thread would silently emit a row pointing at nothing.
  ;(data.questionIndex ?? []).forEach((e, i) => {
    for (const l of e.threads)
      if (!seen.has(l)) fail(`questionIndex[${i}] names unknown thread ${l}`)
  })

  const openedIds = new Set()
  for (const e of data.log) for (const o of e.opened) openedIds.add(o.id)

  data.log.forEach((e, i) => {
    if (!seen.has(e.thread)) fail(`log[${i}].thread ${e.thread} is not a known thread`)
    if (Number.isNaN(Date.parse(e.date))) fail(`log[${i}].date ${e.date} is not a parseable date`)
    if (!existsSync(join(dir, e.note))) fail(`log[${i}].note ${e.note} does not exist`)
    for (const o of e.opened)
      if (!seen.has(o.ask)) fail(`log[${i}] opened "${o.id}" asks unknown thread ${o.ask}`)
    for (const id of e.resolved)
      if (!openedIds.has(id)) fail(`log[${i}] resolves "${id}", which was never opened`)
  })

  return { ...data, dir }
}

const pipsFor = (run, budget) => '●'.repeat(Math.min(run, budget)) + '○'.repeat(Math.max(budget - run, 0))

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
    const stamped = { ...e, pips: pipsFor(t.run, budget) }
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

  const edges = [
    ...byDate.flatMap((e) => e.opened.map((o) => ({ from: e.thread, to: o.ask, label: o.q, kind: 'opened' }))),
    ...data.threads.filter((t) => t.gates).map((t) => ({ from: t.letter, to: t.gates, label: 'gates', kind: 'gates' })),
  ]

  const list = [...threads.values()]
  return {
    threads,
    totals: {
      touched: list.filter((t) => t.state !== 'not-started').length,
      dry: list.filter((t) => t.state === 'dry').length,
      notStarted: list.filter((t) => t.state === 'not-started').length,
    },
    live: list.filter((t) => t.state === 'live')
      .sort((a, b) => Date.parse(b.lastDate) - Date.parse(a.lastDate)).map((t) => t.letter),
    frontier,
    trail: trail.reverse(),
    edges,
    census: data.threads.map(({ letter, name, loop, needs, packages }) => ({ letter, name, loop, needs, packages })),
  }
}

export function loadCampaign(dir) {
  const data = readCampaign(dir)
  return { data, derived: derive(data) }
}
