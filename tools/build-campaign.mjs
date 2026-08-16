#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

/** A campaign directory's own name, for the note page's kicker. */
const name0 = (dir) => dir.split('/').filter(Boolean).pop()
import { join } from 'node:path'
import { loadCampaign, fromRoot } from './campaign/model.mjs'
import { renderRoadmap } from './campaign/render-roadmap.mjs'
import { renderWorklog } from './campaign/render-worklog.mjs'
import { renderNote } from './campaign/render-note.mjs'
import { measureCampaign } from './capture-proxy/measure.mjs'
import { renderBoard } from './campaign/render-board.mjs'
import { checkHtml } from './campaign/checks.mjs'

// The property checks — charset placement, no external references, no <details>, every var(--token)
// defined in the bare :root, every href="#…" resolving, balanced tags — are what the spec calls
// "guaranteed by construction". They were guaranteed only for pages that happened to have a test:
// nothing ran them on the way to disk. Running them here makes them a build gate for every page,
// and a page that fails one is not written at all rather than written and reported.
const gate = (path, html) => {
  const problems = checkHtml(html)
  if (problems.length === 0) return true
  for (const p of problems) console.error(`${path}: ${p}`)
  return false
}

// process.exit() truncates output still queued on a pipe, and the `drift:` lines are the whole
// point of --check in CI. Setting process.exitCode and returning lets Node flush stdout and stderr
// before it exits with the same code.
function main() {
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
    return 1
  }

  let drifted = 0
  let failed = 0
  const models = []
  for (const name of campaigns) {
    try {
      const dir = join('campaigns', name)
      const model = loadCampaign(dir)
      models.push(model)
      // Facts the notes cite come from measurements.json, which is committed; the
      // captures behind it are gitignored, so the build must work without them.
      const measurePath = join(dir, 'measurements.json')
      const measurements = existsSync(fromRoot(measurePath))
        ? JSON.parse(readFileSync(fromRoot(measurePath), 'utf8'))
        : { captures: {} }

      // When the captures ARE present, re-derive and compare: a re-taken capture
      // must not leave a note quietly citing the old numbers.
      if (existsSync(fromRoot(join(dir, 'captures')))) {
        const derived = JSON.stringify(measureCampaign(fromRoot(dir)), null, 2) + '\n'
        const committed = existsSync(fromRoot(measurePath)) ? readFileSync(fromRoot(measurePath), 'utf8') : ''
        if (derived !== committed) {
          if (check) { console.error(`drift: ${measurePath} does not match its captures`); drifted++ }
          else { writeFileSync(fromRoot(measurePath), derived); console.log(`wrote ${measurePath}`) }
        }
      }

      // Every note gets a page rendered from its Markdown, so the prose has one home.
      const notesDir = join(dir, 'notes')
      const notePages = (existsSync(fromRoot(notesDir)) ? readdirSync(fromRoot(notesDir)) : [])
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => {
          const markdown = readFileSync(fromRoot(join(notesDir, name)), 'utf8')
          const title = (markdown.match(/^#\s+(.*)$/m)?.[1] ?? name).replace(/^\d+\s*·\s*/, '')
          return [join('notes', name.replace(/\.md$/, '.html')),
                  renderNote({ markdown, campaign: name0(dir), title, back: '../roadmap.html', measurements })]
        })

      for (const [file, html] of [
        ['roadmap.html', renderRoadmap(model)],
        ['worklog.html', renderWorklog(model)],
        ...notePages,
      ]) {
        const path = join(dir, file)
        if (!gate(path, html)) { failed++; continue }
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
    // `null` had to be rejected explicitly too: it was previously both "not loaded" and a legal
    // parse result, so a board.json containing `null` (or `0`, or `false`) skipped the board and
    // exited 0 — a build that silently produced no index and reported success.
    let board = null
    try {
      const parsed = JSON.parse(readFileSync(fromRoot('campaigns/board.json'), 'utf8'))
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('must be a JSON object')
      }
      board = parsed
    } catch (err) {
      console.error(`campaigns/board.json: ${err.code === 'ENOENT' ? 'does not exist' : err.message}`)
      failed++
    }
    if (board) {
      const html = renderBoard(models, board)
      if (!gate('campaigns/index.html', html)) failed++
      else if (check) {
        const current = existsSync(fromRoot('campaigns/index.html'))
          ? readFileSync(fromRoot('campaigns/index.html'), 'utf8') : ''
        if (current !== html) { console.error('drift: campaigns/index.html does not match its data'); drifted++ }
      } else {
        writeFileSync(fromRoot('campaigns/index.html'), html)
        console.log('wrote campaigns/index.html')
      }
    }
  }

  return (drifted > 0 || failed > 0) ? 1 : 0
}

process.exitCode = main()
