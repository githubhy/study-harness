# M · Inputs & code intelligence

Thread M was pulled to answer A's question: the prompt assembles from mounted plugins, so two profiles
produce different prompts from one binary — is any of that inspectable without running a task?

It is, and running the inspection produced an empirical confirmation of a claim Thread E had only derived,
plus a correction to note 00 that is worth more than either. Read against source at `47f9438`, with
commands run against this checkout.

## `--dump-config` composes without booting

```
dsh --profile <name> --dump-config
```

> compose the profile's patch layers through the include plugin's patch algorithm **without booting or
> evaluating `!!js`**, with one source layer per bundle, the profile's own patch file, and each `--patch`
> overlay.

The output is the composed plugin tree, and every entry is annotated with where it came from:

```
# == @deepseek-ai/dsh-base
- id: llm
  name: '@deepseek-ai/dsh-llm'
# == @deepseek-ai/dsh-base, patched by @deepseek-ai/dsh-headless
- id: hmr
  name: '@deepseek-ai/cordis-plugin-hmr'
  config: { root: ['.'] }
  disabled: true
```

So *"why is HMR off in headless?"* is answerable from the dump alone — the bundle that contributed the
entry and the bundle that patched it are both named. That is unusually good config observability, and it
is what note 00's outside observation ("an ordered stack of plugin-bundle patch layers") looks like from
the inside.

**Answering A's question precisely:** the plugin graph is inspectable without running; the *assembled
system prompt* is not, because sections register at mount and assemble per step (Thread A), which needs a
boot. But since the graph determines which sections exist, the dump tells you what the prompt will be made
of without telling you what it will say.

## Two profiles, measured

| Profile | Plugins | Disabled |
|---|---|---|
| `headless` | **81** | 2 |
| `web` | **129** | 25 |

Same binary, a 48-plugin difference. This is what Thread K meant by the apps being thin: the difference
between "a CLI that answers one task" and "a web application" is entirely a difference in the mounted
graph.

### An empirical confirmation of Thread E

Thread E argued, from four packages that do not reference each other, that **the model can extend the
harness only where a human is present to approve it**. That argument ran through runtime behaviour:
`cordis_run` raises an approval request, approval fails closed with no answerer, headless mounts no
answerer.

The dump shows something stronger. Diffing the two profiles:

```
web only:  cordis-host-runner, cordis-client-runner, ui-cordis
headless:  none of them
```

**The machinery is not mounted in headless at all.** It is not that a self-written plugin would be denied
at runtime — the approval orchestrator, the client runner and the approval UI are simply absent. The
composition enforces the property structurally, and the runtime fail-closed path is the second line of
defence rather than the first.

That is a better result than Thread E's, and I could not have got it by reading source. Deriving a
property and then measuring it is worth the extra step.

## Correction: there is no `tui` profile

Note 00 says, of the CLI's own help text:

> `web`, `tui` and `headless` are profiles.

**`tui` does not exist.** Not as a profile, not as a package, not as a directory anywhere in the checkout:

```
$ dsh --profile tui --dump-config
Error: dsh: profile "tui" does not exist; create it with 'dsh plugin --profile tui add <package>'

$ ls ~/.dsh/profiles          →  headless  web
$ find packages apps -type d -name '*tui*'   →  (nothing)
```

The help text never claimed it. It documents `--profile <name>` and a `web` subcommand alias, and lists no
profile inventory at all. I wrote `tui` into a sentence about what the help text said, and it was never
there.

This is worth recording plainly, because it is the exact failure the blind-observation discipline in note
02 exists to prevent — and it happened in note 00, which was not written blind and therefore had no such
guard. A terminal UI is such a normal thing for a harness to have that the detail completed itself. The
lesson is not "be careful"; it is that **a claim about what a source says needs the same provenance as a
claim about what code does**, and note 00's build-facts section had provenance for its commands and none
for its prose.

Corrected in note 00 with the correction left visible rather than edited away.

## Questions this opens

- Profiles are user-creatable (`dsh plugin --profile <name> add <package>`), and `~/.dsh/profiles` holds
  the two shipped ones plus a `node_modules`. A profile is an npm-installed plugin set, so mounting a
  capability is `pnpm add`. What stops a profile from mounting something that contradicts another
  plugin? → **E**

## Provenance

`--dump-config` run against this checkout for both shipped profiles; counts are `rg -c '^- id: '` over the
output. The `tui` correction is three commands, quoted above with their real output. No API key or capture
required — every measurement in this note is free.
