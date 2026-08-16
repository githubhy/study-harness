#!/usr/bin/env node
// Checks that an assembled site directory is self-contained: every relative link in every page
// resolves to a file that is actually in the directory.
//
// This is not the same check build-campaign.mjs runs. That one resolves links against the *repo*,
// where every target happens to sit next to its page anyway. Publishing copies a subset of the repo
// into a fresh tree, and a subset is exactly where a link that was fine in place becomes a 404 — one
// forgotten pattern in the copy step and a page ships pointing at nothing. So the site gets its own
// check, run against the thing that will actually be served.
//
//     node tools/check-site.mjs _site
//
// Exits 1 and names every problem. Zero dependencies, like everything else in tools/.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve, sep } from 'node:path'

/** Every page the site will serve, so a link can be checked against the real set. */
const pagesIn = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const path = join(dir, e.name)
  return e.isDirectory() ? pagesIn(path) : e.name.endsWith('.html') ? [path] : []
})

// Anchors and absolute URLs are somebody else's problem; this is about files.
const LINK = /(?:href|src)="([^"#][^"]*?)(?:#[^"]*)?"/g
const REMOTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

export function checkSite(root) {
  const problems = []

  if (!existsSync(root) || !statSync(root).isDirectory()) return [`${root} is not a directory`]

  const pages = pagesIn(root)
  // A copy step that silently matched nothing would otherwise pass every check below by having
  // nothing to check — the same shape as a leak checker that scans no files and reports clean.
  if (pages.length === 0) problems.push(`${root} contains no pages`)

  for (const page of pages) {
    const html = readFileSync(page, 'utf8')
    for (const [, href] of html.matchAll(LINK)) {
      if (REMOTE.test(href)) continue
      const target = resolve(dirname(page), href)
      // A link that climbs out of the site resolves on a filesystem and 404s on a server, so it is
      // a failure even when the file exists.
      const inside = relative(resolve(root), target)
      if (inside.startsWith('..') || inside.startsWith(sep)) {
        problems.push(`${relative(root, page)}: ${href} points outside the site`)
      } else if (!existsSync(target)) {
        problems.push(`${relative(root, page)}: ${href} is missing from the site`)
      }
    }
  }
  return problems
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2]
  if (!root) {
    console.error('usage: node tools/check-site.mjs <dir>')
    process.exitCode = 1
  } else {
    const problems = checkSite(root)
    for (const p of problems) console.error(p)
    const pages = existsSync(root) && statSync(root).isDirectory() ? pagesIn(root).length : 0
    if (problems.length === 0) console.log(`${root}: ${pages} pages, every link resolves`)
    process.exitCode = problems.length === 0 ? 0 : 1
  }
}
