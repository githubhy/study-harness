# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — this repo is multi-context. It points at one `CONTEXT.md` per campaign, and carries the shared method vocabulary itself (campaign, subject, specimen, transfer specimen). Read it, then the glossary of whichever campaign you're working in.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. Also check `campaigns/<name>/docs/adr/` for campaign-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is multi-context, and its contexts are **campaigns** — one per subject, under
`campaigns/` rather than the `src/` the skill's default example uses:

```
/
├── CONTEXT-MAP.md                     ← the index, plus shared method vocabulary
├── docs/
│   ├── adr/                           ← the method; outlives any one campaign
│   └── agents/
├── tools/                             ← shared instruments, e.g. the capture proxy
└── campaigns/
    ├── index.html                     ← the campaign board
    └── agent-harnesses/
        ├── CONTEXT.md                 ← this campaign's vocabulary
        ├── roadmap.html
        ├── plan.md
        ├── docs/adr/                  ← campaign-scoped decisions (created lazily)
        └── notes/ captures/ experiments/
```

A campaign is scoped to one **subject**. Adding a second specimen does not start a new campaign;
changing the subject does. Plans live at `campaigns/<name>/plan.md`, not under
`docs/superpowers/plans/` — the campaign folder supplies the context the date-stamped filename
used to carry.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
