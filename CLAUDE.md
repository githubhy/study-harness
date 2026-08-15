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

`campaigns/index.html`, `campaigns/agent-harnesses/roadmap.html`, and `campaigns/agent-harnesses/worklog.html`
are **generated**. Never hand-edit them — edit `campaigns/<name>/campaign.json` and rebuild:

    node tools/build-campaign.mjs --all
    node tools/build-campaign.mjs --all --check   # exits 1 if a page has drifted from its data
    node --test tools/campaign/*.test.mjs         # the generator's own tests

`campaigns/board.json` holds repo-level board data: the standfirst, the "No second campaign yet"
empty state, the ownership table, and Shared language terms. It is not campaign-scoped and must be
edited directly, then rebuilt.

Logging a finding is: write `notes/<LETTER>-<slug>.md`, append one entry to `campaign.json`'s `log`,
rebuild, and commit all of it together. Surprise pips, dry detection, the frontier, totals, the
thread graph, and the package census are all derived — never write them by hand.
