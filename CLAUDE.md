## Agent skills

### Issue tracker

Issues live in GitHub Issues on `githubhy/study-harness`, managed via the `gh` CLI.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as label strings.
See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context. `CONTEXT-MAP.md` at the root is the index and holds the shared method vocabulary;
each campaign carries its own `CONTEXT.md`. See `docs/agents/domain.md`.

## Campaigns

Work is organised into campaigns, **one per subject**, under `campaigns/<name>/`. A campaign owns
its glossary, plan (`plan.md`), roadmap, and working material. Adding a second specimen does not
start a new campaign; changing the subject does.

`docs/adr/` holds the method — decisions that outlive any one campaign. `tools/` holds shared
instruments. Start at `CONTEXT-MAP.md` or `campaigns/index.html`.

Nothing under any `captures/` is ever committed, and this repo is public.

## Generated pages

`campaigns/index.html`, `campaigns/agent-harnesses/roadmap.html`, `campaigns/agent-harnesses/worklog.html`,
and every `campaigns/<name>/notes/*.html` are **generated** — a note's `.md` is the only copy of its prose.
Never hand-edit any of them; edit `campaigns/<name>/campaign.json` (or the note's Markdown) and rebuild:

    node tools/build-campaign.mjs --all
    node tools/build-campaign.mjs --all --check   # exits 1 if a page has drifted from its data
    node --test tools/campaign/*.test.mjs         # the generator's own tests

`campaigns/board.json` holds repo-level board data: the standfirst, the "No second campaign yet"
empty state, the ownership table, and Shared language terms. It is not campaign-scoped and must be
edited directly, then rebuilt.

Logging a finding is: write `notes/<LETTER>-<slug>.md`, append one entry to `campaign.json`'s `log`,
rebuild, and commit all of it together. Surprise pips, dry detection, the frontier, totals, the
thread graph, the package census, each phase's landed/not-landed chip, and the links between notes
are all derived — never write them by hand.

Two consequences worth knowing when writing a note. A phase is shown as landed **iff** it carries a
`writeup`, so adding the report link is what marks it done; there is no status field to set. And
"Thread D" or "→ **D**" in a note's prose becomes a link to D's own note automatically — write the
prose, not the Markdown link.

The build resolves every relative link against where the page will sit on disk and refuses to write
a page that points at a file that does not exist. `checkHtml` sees only a string, so it cannot do
this; two hardcoded footer paths once shipped 44 dead links with every test passing.

### The published site

`.github/workflows/pages.yml` publishes <https://githubhy.github.io/study-harness/> on every push to
`main`. It re-runs `--all --check` and the generator's tests, then assembles **only** the root
redirect and `campaigns/**/*.html` — publishing from the repo root instead served
`tools/campaign/fixtures/`, whose frozen pages carry the same `<title>` as the live ones they
replaced. `tools/check-site.mjs` then proves the assembled directory is self-contained; run it on any
site directory locally. A page added outside `campaigns/` will not be published until the assembly
step is widened to include it.

### Frozen baselines

`tools/campaign/fixtures/roadmap-premigration.html` and `board-premigration.html` are frozen records
of the hand-written pages the generator replaced — they are never edited. Similarly,
`tools/campaign/fixtures/acceptance-phrases.txt` and the board's phrase fixture are the content
contracts the generated pages are checked against, and are never edited to make a failing check pass.

Repo-wide sweeps for stale references must exclude `tools/campaign/fixtures/**` (along with
`.superpowers` and `docs/superpowers/**`, which contain prose describing changes rather than links
to them). Use this form so the exclusions and their reason travel together:

    rg -l '<pattern>' \
      --glob '!.superpowers' --glob '!docs/superpowers/**' --glob '!tools/campaign/fixtures/**' .
