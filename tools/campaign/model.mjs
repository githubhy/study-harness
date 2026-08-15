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
