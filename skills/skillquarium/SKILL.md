---
name: skillquarium
description: Search this vault's 2,100+ skills and manage them with the skillquarium CLI. Use when looking for a skill to do something, when native description matching returns nothing useful, when you need every skill covering a topic rather than the single best match, when searching skill text for an exact string, or when adding, toggling, rebuilding, or updating skills in ~/.agents.
---

# skillquarium

The CLI that owns `~/.agents`: one Bun binary for search, navigation, and vault maintenance.
Run it from the vault root as `./skillquarium <command>`, or by absolute path from anywhere.

Every command takes `--help`. Read that before guessing at flags.

## Finding a skill

Your own description matching ranks skills independently, so it reliably finds the obvious one
and just as reliably misses its neighbours. `query` is for when that is not enough.

```bash
./skillquarium query "batch correct single cell data and find markers"
./skillquarium query "raw fastq to enriched pathways" --k 10
```

It fuses three model-free rankings — BM25 over names and descriptions, typo-tolerant path
matching, and the knowledge graph — then adds skills semantically similar to what it already
found. Each result says which signal produced it:

- `[lexical #3]` matched your words.
- `[fuzzy #1]` matched a misspelled or partial skill name.
- `[similar to harmonypy (cosine 0.88)]` matched nothing you typed; it neighbours a result that did.
- `[bpe #2]` appended after the list: a word piece of your query matched (see "The BPE addon").
- `[produces input for pydeseq2]` came from the graph: it is an adjacent step of the same workflow.

That last kind is the reason to prefer `query` over your own matching for anything multi-step.
A query about one stage of a pipeline returns the stages around it.

**Reach for `--no-semantic` when you know the name and only half-remember its spelling.** The
similarity expansion helps a described task and hurts a named one.

## Searching skill text

`query` reads names and descriptions. When you need the body — a flag, an error string, an
import, a config key — use `grep`, which runs ripgrep over every file under `skills/`.

```bash
./skillquarium grep 'Vary: HX-Request'
./skillquarium grep 'def main' -- -t py
```

A paraphrase finds nothing here. That is the difference: `grep` finds text, `query` finds skills.

## Reading and toggling

```bash
./skillquarium preview scanpy          # description, category, per-product state
./skillquarium list                    # every skill, one per line
./skillquarium disable <skill>...      # stop it loading into context automatically
./skillquarium enable <skill>...
```

Toggling writes `disable-model-invocation` into `SKILL.md` for Claude Code and
`policy.allow_implicit_invocation` into `agents/openai.yaml` for Codex. A disabled skill is still
invocable by name; it just stops consuming context on every turn.

**Committed skills are always activated.** Local toggle state lives in a snapshot, never in the
repo. Before committing, `./skillquarium pre-commit-reset` saves your state and strips the fields;
`./skillquarium load` puts them back afterwards. Skipping the reset commits your personal
toggles to everyone else's tree.

## Maintaining the vault

```bash
./skillquarium build        # regenerate vault/notes, vault/maps, index.md, graph.json
./skillquarium validate     # shape and competency checks over the graph
./skillquarium update       # pull upstream, re-apply local fixes, rebuild, validate
./skillquarium install      # symlink every skill into each agent's skills directory
./skillquarium doctor       # what is installed, and whether the embedding endpoint answers
```

`build` is a fixed point: running it on an unchanged tree changes no bytes. If it dirties
`vault/`, something upstream of it changed and the diff is the evidence.

## Adding a skill

1. Put the folder at `skills/<id>/SKILL.md`. Keep an upstream folder's original name, or
   `skills update` will lose track of it.
2. Upstream skills need a `.skill-lock.json` entry; a skill you wrote does not.
3. Record every local edit to an upstream skill in `.skill-vault/data/local-overrides.json`, or
   the next sync silently reverts it. An insertion-only override needs an anchor whose `find`
   text stops matching once applied, otherwise it reports pending forever.
4. Assign a domain in `extraAssignments` in `.skill-vault/src/build/categories.json`, else the
   skill lands in Uncategorized.
5. `./skillquarium build` then `./skillquarium validate`.
6. `./skillquarium embed` refreshes the vector index so the new skill is reachable by similarity.

## The embedding index

`vault/embeddings/` is committed: one float16 file per skill, holding a vector for its
description and one for its body. `./skillquarium embed` rebuilds only what changed, against a
local llama.cpp endpoint configured in the gitignored `.skill-vault/config.local.json`.

**No search command ever contacts that endpoint.** Building the index needs it; using it does
not. With no index at all, `query` still answers from BM25, fuzzy matching, and the graph.

`embed --check` lists what has drifted without touching the network. Toggling is not drift: the
toggle fields are stripped before hashing and before embedding, so a vector cannot depend on
whether the skill is switched on, and a rebuilt index is the same bytes whoever runs it.

## The BPE addon

After the regular results, `query` appends up to `query.bpeExtra` (default 5) skills from a second
BM25 over the word pieces of `vault/tokenizer/tokenizer.json`, skipping any already listed. They are
tagged `[bpe #N]` and catch word forms ASCII matching misses: `binary` and `binaries` share a piece.
Nothing before them moves, so the first k results are the same with or without it. The pieces also
produce false hits (`rowbinary` shares `binar`), which is why they are appended rather than fused.
`--no-bpe` or `bpeExtra: 0` turns it off. `query --eval` scores the appended list as `+bpe` next
to `ascii@N`, the regular pipeline asked for the same number of results.

`./skillquarium tokenizer [--vocab-size N]` retrains the model from the tracked markdown under
`skills/`, toggle fields stripped, using the `skill-tokenizer` binary on PATH or at
`tokenizer.bin`. Queries encode in-process and never run it. The corpus alphabet is about 2,800
characters and the trainer spends vocab on those first, so a vocab below that yields no merges;
`tokenizer` refuses to install such a model. If the model file is missing, `query` returns the
regular list and says so on stderr.
