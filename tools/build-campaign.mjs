#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadCampaign, fromRoot } from './campaign/model.mjs'
import { renderRoadmap } from './campaign/render-roadmap.mjs'
import { renderWorklog } from './campaign/render-worklog.mjs'
import { renderBoard } from './campaign/render-board.mjs'

const args = process.argv.slice(2)
const check = args.includes('--check')
const all = args.includes('--all')
const named = args.filter((a) => !a.startsWith('--'))

// Paths are resolved against the repo root (fromRoot), never the cwd, so the tool runs from any
// directory. The unresolved forms stay for messages: a reader wants `campaigns/x/roadmap.html`,
// not an absolute path from someone else's machine.
const campaigns = all
  ? readdirSync(fromRoot('campaigns'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(fromRoot('campaigns', d.name, 'campaign.json')))
      .map((d) => d.name)
  : named

if (campaigns.length === 0) {
  console.error('usage: node tools/build-campaign.mjs <campaign> [--check] | --all [--check]')
  process.exit(1)
}

let drifted = 0
let failed = 0
const models = []
for (const name of campaigns) {
  try {
    const dir = join('campaigns', name)
    const model = loadCampaign(dir)
    models.push(model)
    for (const [file, html] of [
      ['roadmap.html', renderRoadmap(model)],
      ['worklog.html', renderWorklog(model)],
    ]) {
      const path = join(dir, file)
      if (check) {
        const current = existsSync(fromRoot(path)) ? readFileSync(fromRoot(path), 'utf8') : ''
        if (current !== html) { console.error(`drift: ${path} does not match its data`); drifted++ }
      } else {
        writeFileSync(fromRoot(path), html)
        console.log(`wrote ${path}`)
      }
    }
  } catch (err) {
    console.error(err.message)
    failed++
  }
}

if (all) {
  // The board sits outside the per-campaign try/catch above, so a missing or malformed
  // board.json used to throw an uncaught ENOENT with a stack trace — the one failure in this
  // tool that did not name its own path.
  let board = null
  try {
    board = JSON.parse(readFileSync(fromRoot('campaigns/board.json'), 'utf8'))
  } catch (err) {
    console.error(`campaigns/board.json: ${err.code === 'ENOENT' ? 'does not exist' : err.message}`)
    failed++
  }
  if (board) {
    const html = renderBoard(models, board)
    if (check) {
      const current = existsSync(fromRoot('campaigns/index.html'))
        ? readFileSync(fromRoot('campaigns/index.html'), 'utf8') : ''
      if (current !== html) { console.error('drift: campaigns/index.html does not match its data'); drifted++ }
    } else {
      writeFileSync(fromRoot('campaigns/index.html'), html)
      console.log('wrote campaigns/index.html')
    }
  }
}

process.exit((drifted > 0 || failed > 0) ? 1 : 0)
