# Context map

A study workspace, not a product. Work here is organised into **campaigns** — one per subject.
Each campaign owns its own glossary; the method, the instruments, and the vocabulary below are shared
across all of them.

## Campaigns

| Campaign | Subject | Specimen | Transfer specimen | Glossary |
|---|---|---|---|---|
| [`agent-harnesses`](campaigns/agent-harnesses/) | Agent harnesses as a category | `deepseek-harness` @ `47f9438` | Claude Code (local transcripts) | [CONTEXT.md](campaigns/agent-harnesses/CONTEXT.md) |

Start at [`campaigns/index.html`](campaigns/index.html) for the board, or open a campaign's
`roadmap.html` directly.

## What lives where

| Path | Scope |
|---|---|
| `campaigns/<name>/CONTEXT.md` | That campaign's vocabulary — its output |
| `campaigns/<name>/campaign.json` | The source of truth for that campaign's generated pages |
| `campaigns/<name>/roadmap.html`, `worklog.html` | **Generated** from `campaign.json` — never hand-edited |
| `campaigns/<name>/plan.md` | Its executable plan |
| `campaigns/<name>/docs/adr/` | Decisions scoped to that campaign (created lazily) |
| `campaigns/<name>/notes/`, `captures/`, `experiments/` | Its working material |
| `docs/adr/` | The **method** — decisions that outlive any one campaign |
| `docs/agents/` | Issue tracker, triage labels, domain-doc rules |
| `tools/` | Shared instruments, e.g. the capture proxy |

`captures/` is gitignored in every campaign and this repo is public — see the standing orders on any
campaign roadmap before writing anything to disk.

## Shared language

These four terms are method vocabulary. They mean the same thing in every campaign, so they are
defined here rather than in any one glossary.

`campaigns/index.html` shows the same four, abridged, from `campaigns/board.json`. The **names** are
the vocabulary and must match this list exactly — a test asserts it. The board's bodies are
deliberately shorter; the definitions below are the canonical ones.

**Campaign**:
One investigation, scoped to **one subject**. It owns a glossary, a plan, a roadmap, and its working
material. Adding a second specimen does not start a new campaign; changing the subject does.
_Avoid_: Study, project, investigation (as a proper noun)

**Subject**:
The category a campaign is ultimately about — never a particular artefact. A finding matters only
insofar as it generalises to the subject.

**Specimen**:
The particular artefact being dissected to learn about the subject. A campaign has one primary
specimen, chosen for being open and readable rather than for being representative.

**Transfer specimen**:
A second artefact the campaign's vocabulary was **not** derived from, used to falsify it. Predictions
about the transfer specimen are committed before it is examined, or the test proves nothing. A campaign
without one cannot distinguish a category insight from an implementation detail of its specimen.
