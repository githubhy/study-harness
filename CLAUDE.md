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
