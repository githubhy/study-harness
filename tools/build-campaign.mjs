#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadCampaign } from './campaign/model.mjs'
import { renderRoadmap } from './campaign/render-roadmap.mjs'
import { renderWorklog } from './campaign/render-worklog.mjs'

const args = process.argv.slice(2)
const check = args.includes('--check')
const all = args.includes('--all')
const named = args.filter((a) => !a.startsWith('--'))

const campaigns = all
  ? readdirSync('campaigns', { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join('campaigns', d.name, 'campaign.json')))
      .map((d) => d.name)
  : named

if (campaigns.length === 0) {
  console.error('usage: node tools/build-campaign.mjs <campaign> [--check] | --all [--check]')
  process.exit(1)
}

let drifted = 0
let failed = 0
for (const name of campaigns) {
  try {
    const dir = join('campaigns', name)
    const model = loadCampaign(dir)
    for (const [file, html] of [
      ['roadmap.html', renderRoadmap(model)],
      ['worklog.html', renderWorklog(model)],
    ]) {
      const path = join(dir, file)
      if (check) {
        const current = existsSync(path) ? readFileSync(path, 'utf8') : ''
        if (current !== html) { console.error(`drift: ${path} does not match its data`); drifted++ }
      } else {
        writeFileSync(path, html)
        console.log(`wrote ${path}`)
      }
    }
  } catch (err) {
    console.error(err.message)
    failed++
  }
}
process.exit((drifted > 0 || failed > 0) ? 1 : 0)
