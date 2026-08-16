# 00 · Orientation

Task 0.1's output: the specimen pinned and built, and the two values every later task consumes by name.
Written 2026-08-16.

## The specimen

| | |
|---|---|
| Repo | `deepseek-ai/deepseek-harness`, cloned to `../deepseek-harness` |
| Pinned at | `47f943859bef60e4160492346772ded9b24f765a` (detached HEAD) |
| Commit date | 2026-08-13 |
| Version | `@deepseek-ai/dsh-root@0.1.0-rc.5` |

The pinned SHA **was still the default-branch head** at clone time, so nothing has moved upstream since
the plan was written. That will not stay true; every finding in this campaign is against this SHA.

## The two discovered values

**`LLM_BASE_URL_ENV` = `DEEPSEEK_BASE_URL`**

Resolved in `packages/llm/llm-deepseek/src/index.ts:185-187`:

```
baseURL: config.baseURL
  ?? environment?.get(BASE_URL_ENV)?.value
  ?? PUBLIC_BASE_URL          // https://api.deepseek.com
```

It does **not** read `process.env` directly. It goes through a `LaunchEnvironmentSnapshot` from
`packages/util/launch-environment`, which resolves a name across three layers in a fixed trust order:

```
'process' | 'project-env' | 'user-env'      // most trusted first
```

This matters for the capture proxy, and it matters favourably. `process` is the **most** trusted layer,
so exporting `DEEPSEEK_BASE_URL` in the launching shell both reaches the adapter *and* cannot be
silently overridden by a `.env` in the working directory or in `$DSH_HOME`. A proxy put in the path
this way stays in the path.

The adapter posts to `` `${connection.baseURL}/chat/completions` `` (`adapter.ts:301`), so the wire
format is OpenAI-compatible as the plan assumed — the proxy forwards without translating.

**`DSH_CMD` = `pnpm dsh --profile headless "<task>"`**

From the CLI's own help: *"answer one task, print the result, and exit."* Confirmed by running it, not
inferred from source — the arg parser in `apps/cli/src/args.ts` exposes only `--profile`, `--patch`,
`--dump-config`, `--dump-default-config`, and subcommands `web` / `plugin`, so the headless mode is a
**profile**, not a flag. Reading the parser alone would have missed it.

## Build facts

Node v26.4.0, pnpm 11.7.0. `pnpm install --frozen-lockfile` and `pnpm build` both exit 0 on macOS.

Two corrections to the plan's Task 0.1:

- **`corepack enable` is neither available nor needed here.** The command does not exist on this
  machine, but pnpm honours the root `packageManager: pnpm@11.7.0` field by itself — the shell's
  pnpm 10.33.0 resolves to 11.7.0 inside the repo.
- **`ls packages | wc -l` reports 54, not 49.** Five of those entries are files
  (`README.md`, `README.zh.md`, `README.i18n.yaml`, `AGENTS.md`, `CLAUDE.md`). There are exactly **49
  package directories**, and the roadmap's census names every one — verified against this checkout,
  not against the frozen snapshot the generator tests use.

## Two things worth knowing before Phase 1

**dsh boots "profiles", not commands.** `dsh --help` describes a profile as *"an ordered stack of
plugin-bundle patch layers under your own overrides"*, with `--patch` applying a further overlay.
`web`, `tui` and `headless` are profiles. This is the Cordis plugin architecture surfacing at the
command line, and it is Thread E's subject arriving a phase early — the extension boundary is the
*first* thing the CLI exposes, before any notion of a task.

**There is a built-in mock LLM server**, `packages/test-support/llm-mock-server`, with its own CLI and
a `pnpm mock:llm` script. If it speaks the same `/chat/completions` shape, a capture could be taken
with **no API key and no spend at all** — which would change what Phase 2 costs and would let Threads A
and C start without the DeepSeek key. Not yet verified; worth ten minutes before building the proxy.

## Not yet done

Task 0.2 — the capture proxy — and its one non-negotiable check:

```
rg -n 'sk-|Bearer' captures/session-smoke.jsonl     # must print nothing
```
