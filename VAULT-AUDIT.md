# Skill-vault audit

Generated 2026-07-24 by a 49-agent audit workflow (4 cross-cutting structural lenses in
parallel with a per-domain review across all 24 domain maps → adversarial verification of
every flagged claim → synthesis). ~3.5M tokens, 0 agent errors. The highest-impact claims
were then re-checked by hand against the files (see [Verification](#verification)).

**Overall:** the vault is healthy — most version-sensitive skills cite current 2026 releases
and many carry honest staleness notes. The problems are **structural, not rot**.

## How to use this file

Tick the box of anything you want fixed. Each item has a stable ID (`PRI-1`, `DEP-3`, …),
a severity/confidence tag, evidence, and a recommended action. Tell me the IDs (or "all
high", "all PRI", a whole section) and I'll implement them. Nothing here has been changed yet.

- `[H]` high · `[M]` medium · `[L]` low   ·   confidence shown for deprecations.

---

## 0. Scale & counts are wrong (fix before anything cosmetic)

- [x] **SCALE-1** `[H]` `index.md:11` claims **1308 skills / 24 domains**; real count is **~1253 skill dirs**. Regenerate from disk.
- [x] **SCALE-2** `[H]` `README.md:73` says **23 domains**; `index.md` says 24 (and lists 24). Fix README to 24.
- [x] **SCALE-3** `[M]` Per-domain subtotals in `index.md` sum to 1205 with an anomalous **504** entry (the personas); `SKILL.md` file scans return 1798 because the gstack bundle + nested `references/` inflate it. Make headline, subtotals, and their sum agree; exclude gstack + the 504 personas from the flat A–Z count/list.
- [ ] **SCALE-4** `[H]` `skill-lock.json` tracks only **385 of 1253** on-disk dirs (~69% have no source/hash/installedAt), so version/integrity drift can't be validated for most of the vault. Decide whether the lock is authoritative (backfill hashes) or intentionally remote-install-only (document that scope).
    - lock file is only for remote skills 

---

## 1. Top priorities (ranked)

- [ ] **PRI-1** `[H]` **Stage untracked generated files before the next commit.** `index.md`/`qa.md`/`gstack.md` link to untracked `_gstack-command.md`, and `langfuse/SKILL.md` links to untracked `langfuse/references/sdk-upgrade.md`. A routine `git add -u` would commit dangling links — use `git add -A` (or add the two files explicitly). Also review the tracked deletion of `vercel-react-view-transitions/metadata.json`.
- [x] **PRI-2** `[H]` **Repair invocation-breaking references** (details in MNT-1, MNT-2, MNT-6).
- [x] **PRI-3** `[H]` **Regenerate the navigation layer from disk** (covers SCALE-1..3).
- [x] **PRI-4** `[H]` **Delete dead artifacts** (DEP-1, DEP-2, DEP-3).
- [x] **PRI-5** `[H]` **Retire/merge confirmed duplicates** (DEP-5..10).
- [x] **PRI-6** `[H]` **Fix stale APIs/tools** (DEP-4, DEP-7, DEP-11, DEP-12, DEP-14, MNT-5).
- [x] **PRI-7** `[H]` **Add one-line disambiguation** to the worst activation-collision clusters (Section 5).
- [x] **PRI-8** `[H]` **De-rank the 504 personas** from `index.md`'s flat A–Z list (keep behind the map/dispatcher) — see USE-2, USE-3.
- [ ] **PRI-9** `[M]` **Harden the build pipeline** (MNT-7): document `skill-lock.json` scope, add a pre-commit/CI gate that runs `build.py` and fails on diff, derive domain from SKILL.md frontmatter instead of the hardcoded `CATEGORIES` list.
- [ ] **PRI-10** `[M]` **Fill highest-impact coverage gaps** and kill dangling routes (GAP-1, GAP-2, GAP-4).

---

## 2. Deprecated / retire candidates

### Prune (dead artifacts)
- [x] **DEP-1** `[H, high]` `graphify.backup-20260612T121702Z` — dated backup snapshot of graphify (lives in `~/.claude/skills`, outside the vault); live graphify is maintained. → delete.
- [x] **DEP-2** `[H, high]` `dynamic-resources` — placeholder; entire body is "This skill is provided by the dynamic-resources extension". → remove from vault + `vault-meta` map.
- [x] **DEP-3** `[H, high]` `repro-enforcer` — unimplemented stub: `SKILL.md:51` "**Planned** — implementation targeting Week 6 (Apr 3–9)", dir has only `SKILL.md`, no `repro_enforcer.py`, yet claims 7 executable capabilities. → prune (or implement).

### Stale API / tool
- [ ] **DEP-4** `[H, high]` `torchdrug` — no PyPI release since 0.2.1 (Jul 2023), incompatible with Python ≥3.11 / PyTorch ≥2.1 (uninstallable); skill itself says "Removal may be appropriate". → archive/demote to a stub pointing at `deepchem` + `torch-geometric`.
- [ ] **DEP-11** `[M, medium]` `etetoolkit` — built entirely on dead `ete3` (last release May 2023); successor is `ete4` with an incompatible API. → update to ete4 or mark legacy.
- [ ] **DEP-7** `[H, high]` `differential-expression` — teaches deprecated PyDESeq2 `design_factors=[...]` API + old 0.4 floor; current 0.5.x uses formulaic `design='~condition'`, and the `pydeseq2` skill explicitly warns against the deprecated args (starter fails on a current install). → update API + floor, or merge into `pydeseq2`.
- [ ] **DEP-12** `[H, high]` `pufferlib` — teaches the v1 top-level PuffeRL API that `pufferlib-v2`/`-v3` flag deprecated, but ships an unpinned `uv pip install pufferlib` (`SKILL.md:425`) that installs 3.x → broken combination; its version-neutral description also out-competes v2/v3 for activation. → pin `pufferlib==1.0.0` and defer to `pufferlib-v3`, or retire.
- [ ] **DEP-14** `[M, medium]` `paper-2-web` — documents `gpt-3.5-turbo` (EOL) and defaults to GPT-4; wraps external repo `github.com/YuhangChen1/Paper2All`. → update model IDs; verify/pin upstream.
- [ ] **DEP-15** `[M, medium]` `protocolsio-integration` — pins v3 retrieval/steps endpoints while `protocols-io` uses v4; overlaps on search/retrieve/steps but is a write/publish superset. → upgrade to v4 and consolidate (don't delete).

### Merge duplicates
- [ ] **DEP-5** `[H, high]` `vcf-annotator` → merge into `variant-annotation` (same ClawBio VEP/ClinVar/gnomAD annotator; the inferior implementation — its own gotchas admit live ClinVar returns presence/absence only; `variant-annotation` is the canonical partner of `clinical-variant-reporter`).
- [ ] **DEP-6** `[H, high]` `bgpt-mcp` → merge into `bgpt-paper-search` (same BGPT remote MCP server, same `search_papers` tool/endpoint/author; bgpt-mcp is v0.1.0 vs the cleaner v1.1).
- [ ] **DEP-8** `[M, medium]` `pathway-enricher` → merge into `pathway-enrichment` (Enrichr-only ORA v0.1.0 vs the ORA+GSEA+preranked+ssGSEA/GSVA superset v1.0; preserve its bubble-chart/report-bundle output when folding in).
- [ ] **DEP-9** `[M, medium]` `rnaseq-de` → consolidate into `pydeseq2` + one orchestrator (three in-domain skills implement the same bulk/pseudo-bulk DESeq2 workflow).
- [ ] **DEP-10** `[M, medium]` `cell-detection` → merge into `cellpose-cell-segmentation` (narrow cpsam/Cellpose-4.0 wrapper v0.1.0 vs broader Cellpose-4.2.1 v1.1; fold in its `report.md`/reproducibility CLI).
- [ ] **DEP-13** `[M, medium]` `debugging-and-error-recovery` → merge into `systematic-debugging` (fold in the distinct triage decision-trees + "treat error output as untrusted" guidance, which the target lacks).

### Low urgency
- [ ] **DEP-16** `[L, low]` `design-taste-frontend-v1` — self-declared superseded v1 kept for back-compat while v2 is "experimental". → keep as a pinned fallback but drop from the active map so it stops competing for activation.
- [ ] **DEP-17** `[L, low]` `wes-clinical-report-es` — localized near-duplicate of `wes-clinical-report-en` (mainly output language). → keep (already cross-linked) or consolidate behind a `--lang` flag.

> Dropped after verification: a `quantum-information-scientist` deprecation claim was **refuted** (its content was current) and is not listed here.

---

## 3. Knowledge gaps

- [x] **GAP-1** `[H]` (Cloud/Infra) No **Terraform/OpenTofu** IaC skill — only AWS/CloudFormation-only `aws-cdk-development`. Largest single infra hole. → add terraform/opentofu (providers, state/backends, modules, plan/apply, drift).
- [ ] **GAP-2** `[H]` (ML/AI) No **gradient-boosting** skill (XGBoost/LightGBM/CatBoost) despite `optuna` and `shap` naming them as primary targets. → add gradient-boosting (or per-library).
- [x] **GAP-3** `[H]` (Data Science) No standalone **pandas** skill (nor general NumPy/SciPy). → add pandas (copy-on-write, pyarrow dtypes, chaining, pitfalls); or document polars as the intended default.
- [x] **GAP-4** `[H]` (Data Science / Imaging) **Dangling cross-refs to nonexistent skills:** matplotlib/seaborn → a nonexistent `plotly`; `cellpose-stardist-bioimage`/`cell-detection` → nonexistent StarDist; `flowio` → absent FlowKit. → add those skills or remove the dangling routes.
- [x] **GAP-5** `[M]` (Single-Cell) No **cell–cell communication / ligand-receptor** skill (CellPhoneDB/CellChat/LIANA), named as a companion in two scRNA skills. → add cell-communication (LIANA+/squidpy ligrec); consider Milo/scCODA + CellRank/Palantir.
- [x] **GAP-6** `[M]` (Drug Discovery) No classical/physics-based **docking** (AutoDock Vina/smina/GNINA) — `diffdock` hands off to GNINA/MM-GBSA with no target skill; also no open-source FEP, no maintained retrosynthesis. → add Vina/smina/GNINA, OpenFE/OpenMM RBFE, AiZynthFinder.
- [ ] **GAP-7** `[M]` (Genomics) Stat-gen stack missing **LDSC** (h2/rg), **colocalization** (coloc/SuSiE), imputation/phasing, and **GRCh37↔38 liftover** (the PRS skills warn about it but can't resolve it). → add LDSC, coloc (consuming existing region-fetch output), imputation/phasing, CrossMap/liftOver.
- [ ] **GAP-8** `[M]` (Writing/Pipelines) No **response-to-reviewers/rebuttal**, preprint-submission (arXiv/bioRxiv), venue-selection, or figure/data-integrity skill. → add them (`nature-response` covers Nature-family rebuttal — generalize/cross-link).
- [ ] **GAP-9** `[M]` (Imaging/Biosignals) No **MNE-Python** (EEG/MEG) or **nibabel/nilearn** (MRI/fMRI), and no general microscopy bioimage I/O (OME-Zarr/aicsimageio). → add downstream of `bids`.
- [ ] **GAP-10** `[H]` (Security) No **CVE/dependency scanning** (osv-scanner/grype/trivy), secrets (gitleaks/trufflehog), or container/IaC (checkov/tfsec) — `supply-chain-risk-auditor` explicitly excludes CVE scanning. → add SCA (SARIF → `sarif-parsing`), secret scanner, container/IaC scanner.
- [x] **GAP-11** `[M]` (Software Dev) No **JS/TypeScript** language-idioms skill, no **SQL/relational-DB or schema-migration** skill, no package-publishing skill (despite JS test runners + DB-backed FastAPI/Docker skills). → add modern-typescript, relational-databases/migrations, publishing-packages.
- [ ] **GAP-12** `[M]` (Personas) No **routing/composition layer** between the 504 personas and same-topic tool skills. → add "pairs with: <tool-skill>" cross-links + disambiguate the persona/tool name collisions.
- [ ] **GAP-13** `[M]` (Reasoning) No structured **decision-analysis** skill despite "Decision" in the domain title. → add MCDA/weighted-scoring, decision trees, pre-mortem.
- [x] **GAP-14** `[M]` (.NET) No **.NET Framework → modern .NET** migration (matrix starts at .NET 8) and no **xUnit/NUnit** authoring (only MSTest); no gRPC/SignalR/EF-Core-migrations. → add migrate-netfx-to-net, writing-xunit-tests, dotnet-grpc/signalr/ef-core-migrations.
- [ ] **GAP-15** `[M]` (Analytics/LLMOps) Eval/observability limited to Langfuse/Phoenix/Logfire — no vendor-neutral OTel-GenAI or LangSmith/Ragas, no dbt Slim-CI/CD, no incremental/snapshots. → add those.
- [ ] **GAP-16** `[M]` (Bio DB / Proteomics) No Terra/AnVIL, Synapse, or dataset-deposition (Zenodo/Figshare/Dryad); proteomics lacks TMT/isobaric quant, PTM/phospho, untargeted-metabolomics stats, glycoproteomics MS. → add them.
- [ ] **GAP-17** `[M]` (Sequence/Phylo) No **de novo assembly** (SPAdes/MEGAHIT/Flye — `busco-assessor` has nothing to produce assemblies) or **Bayesian phylogenetics/dating** (BEAST2/MrBayes/treetime). → add assembly (feeding busco/sourmash) + Bayesian/dating (or trim molecular-clock claims).
- [ ] **GAP-18** `[M]` (Quantum/Physics) No **ASE** or ML-interatomic-potential (MACE/CHGNet/matgl), no QEC/stabilizer (stim) — `pymatgen` names ASE as an integration target. → add ase, an MLIP skill, stim/pymatching.
- [ ] **GAP-19** `[M]` (Documents) Local/Microsoft-OOXML only: no Google Workspace (Docs/Sheets/Slides), no tagged-PDF/PDF-A/redaction, no .eml/.msg email. → add google-workspace, extend `pdf`, add email handling.
- [ ] **GAP-20** `[M]` (Vault Meta) No **vault-maintenance skill** documenting this vault's own conventions (adding a skill to a map, regenerating `index.md`, wrapper status/domain frontmatter, the build command). → add it + a host-agnostic SKILL.md authoring reference distinct from the ClawBio-bound `skill-builder`.

---

## 4. Maintainability

- [x] **MNT-1** `[H]` `nature-writing`, `nature-reader`, `nature-paper2ppt` list `../nature-shared/core/*.md` (terminology-ledger, reader-workflow, paper-type-taxonomy, ethics) under `always_load`, but **`nature-shared/` does not exist** anywhere in the vault/git history — every invocation is told to read absent files. → create `nature-shared/core/` or remove the entries and inline the content; reconcile prose vs manifests.
- [x] **MNT-2** `[H]` ClawBio DTC-genetics cluster (`pharmgx-reporter`, `drug-photo`, `methylation-clock`, `profile-report`, `clinical-trial-finder`, `wes-*`) documents a `clawbio.py` runner that doesn't exist and a `skills/<name>/` path prefix while skills live flat. → rewrite CLI examples to the flat layout (e.g. `python pharmgx-reporter/pharmgx_reporter.py`) or note paths assume the upstream ClawBio repo root; fix `methylation-clock`'s `skills/`-prefixed PROVENANCE.md link.
- [x] **MNT-6** `[H]` `literature-review` instructs `gget search pubmed` / `gget search biorxiv` (`SKILL.md:97-98,304,322`), which don't exist (`gget search` is Ensembl-gene-only; no biorxiv module). → replace with `paper-lookup`/Entrez/bioRxiv API; reserve gget for real modules.
- [ ] **MNT-3** `[H]` `skill-lock.json` is a partial manifest (385/1253) — see SCALE-4.
- [ ] **MNT-4** `[H]` `git add -u` would ship dangling links — see PRI-1.
- [x] **MNT-5** `[H]` `imaging-data-commons` self-contradicts on version: frontmatter/top say idc-index 0.12.3 / data v24, but the version-check code, "Tested with", and Best Practices repeatedly say v23 / 0.11.14. → one sweep to reconcile.
- [x] **MNT-7** `[M]` The generated navigation layer is committed but nothing enforces regeneration, so it drifts from source; domain membership is a hardcoded `CATEGORIES` list that silently miscategorizes new skills. → pre-commit/CI check running `build.py` (fail on diff); derive domain from frontmatter or fail on any uncategorized skill.
- [x] **MNT-8** `[M]` An identical ~30-line "Visual Enhancement with Scientific Schematics" block (hardcoded `generate_schematic.py` path) is copy-pasted into `docx`/`pptx`/`xlsx`/`pdf`/`markitdown` — nonsensical in the read-only `markitdown` converter. → replace with a one-line cross-ref to `scientific-schematics`; delete from `markitdown`/`liteparse`.
- [x] **MNT-9** `[M]` Broken cross-refs to nonexistent helper skills: fuzzing cluster → `fuzz-harness-writing`/`fuzzing-dictionaries`/`fuzzing-corpus`/`address-sanitizer`/`libafl` (actual names differ or absent); `constant-time-testing` defers to absent `dudect`/`timecop`; `semgrep` → nonexistent `semgrep-rule-variant-creator`. → rename to actual skills (`harness-writing`, `fuzzing-dictionary`, `semgrep-rule-creator`), create the missing helpers, or drop the rows.
- [x] **MNT-10** `[M]` `autoskill` references a superseded model id (`claude-opus-4-7`) and hardcodes a stale "135 skills" count in two places. → current/version-neutral model id; dynamic count.
- [x] **MNT-11** `[M]` `crap-score`'s DO-NOT-USE-FOR redirects project-wide coverage to generic `coverage-analysis` rather than `.NET`-specific `dotnet-coverage-analysis`. → fix the redirect; disambiguate generic vs .NET coverage.
- [ ] **MNT-12** `[L]` Stray gstack alias/backup artifacts cause count drift + a listed-but-empty skill: `_gstack-command` (symlink to `gstack/SKILL.md`), `gstack-claude` (symlinked dir), `graphify.backup-*`. → have `discover_skills()` skip underscore-prefixed/symlinked duplicates + backups, or remove the alias dirs.
- [ ] **MNT-13** `[L]` Version pins missing/aging on otherwise-good skills: `shap` (no anchor), `qiskit` (no pin, post-1.0 fast-mover), `pymatgen` (2024.x/2023.x, Py3.10), `paraview` (5.12.1 vs released 6.0/6.1 — affects `ttk-viz`), `pymc` date inconsistency, `neurokit2`/`pandera-validation` unpinned. → add "tested against <date>" lines; re-verify paraview examples against 6.1.
- [ ] **MNT-14** `[L]` Frozen-upstream cluster (`diffdock` EOL-Python, `molfeat`/`datamol`/`medchem`/`pytdc`) carries correctly-disclosed but unmanaged "as of mid-2026" claims. → keep; reference the linked issue tracker as source of truth instead of duplicating dated numbers inline.
- [ ] **MNT-15** `[L]` Oversized monolithic SKILL.md that already have `references/` dirs to offload to: `latex-posters` (1594 lines), `treatment-plans` (1579), `clinical-reports` (1127), `gstack` (992), `dnasp` (729), `timesfm` (~780), `shap` (~560), `nfcore-scrnaseq-wrapper` (~500), `phoenix-cli` (409). → move deep detail into `references/`, keep SKILL.md to trigger/overview/routing.
- [ ] **MNT-16** `[L]` `status: untried` is uniform across essentially every wrapper, so the field carries no triage signal. → smoke-test high-traffic/tool-backed skills and promote their status, or document "untried" as the intended baseline.

---

## 5. Usability — activation collisions

Dominant theme: many skills fire on the same trigger with no disambiguation.

- [x] **USE-1** `[H]` **Office tooling collides:** native `docx`/`pptx`/`xlsx` (2026-06-09) vs richer `officecli-docx/-pptx/-xlsx` (2026-07-11, which anchor `morph-ppt`/`pitch-deck`/`financial-model`); also `academic-paper` vs `officecli-academic-paper`, and the `officecli` umbrella vs its per-format skills. Neither generation references the other. → pick one canonical family (officecli) with base/scene-layer routing; demote native ones to a legacy "raw OOXML inspection" fallback with disjoint triggers, or retire.
- [x] **USE-2** `[H]` **504 personas collide with same-topic tool skills:** `structural-biologist` vs `structural-biology`; `phylogeneticist` vs `phylogenetics`/`-builder`; `statistician` vs `statistical-analysis`/`statsmodels`; `single-cell-biologist` vs `scanpy`/`seurat`/`scvi-tools`; `proteomics-scientist` vs `proteomics`/`pyopenms`. → add explicit disambiguation to each colliding persona (as `bioinformatics-engineer` already does), or tag personas so the dispatcher prefers a concrete tool skill when one exists.
- [x] **USE-3** `[H]` **Personas bury the flat A–Z list** (~40% of it; e.g. sedimentologist/seismologist interleaved with scanpy/seurat/scikit-learn). → exclude `scientific-agents-profile` skills from the flat A–Z (keep behind the map/dispatcher) or segregate into a collapsed section.
- [x] **USE-4** `[H]` **Literature discovery is a collision zone:** 3 generic web-search skills (`exa-search`, `parallel-web`, `research-lookup` — the last wraps parallel-web) all claim academic prioritization; 5 skills (`pubmed-search`, `pubmed-summariser`, `lit-synthesizer`, `paper-lookup`, `literature-review`) all fire on "find papers"/"pubmed" with no boundaries. → one default web-search per API key + reframe `research-lookup` as an alias; add "use when" boundaries (single PubMed query vs multi-DB lookup vs synthesized report vs PRISMA review) or collapse the two thin PubMed skills.
- [x] **USE-5** `[H]` **~6 premium/anti-slop UI build skills** compete on generic "make this look premium": `frontend-design`, `high-end-visual-design`, `gpt-taste`, `design-taste-frontend`(+v1), `redesign-existing-projects`, `stitch-design-taste`. (Image-gen / tool-specific / style-preset / read-only-audit siblings DO differentiate.) → add a one-line "use this when / not when" axis (build-new vs redesign-audit vs named-preset vs external-tool); merge the weakest generalists; drop v1 from the active map.
- [x] **USE-6** `[H]` **`query-*` family (11) collides with `database-lookup`** (ships reference files for the same 12 DBs) and with `clinpgx`/`query-opentarget` — no cross-refs, so a UniProt question has no routing criterion. → make `database-lookup` the explicit fallback for DBs WITHOUT a dedicated skill and defer to `query-*` for the ones it duplicates (or fold the `query-*` skills in as reference entries).
- [x] **USE-7** `[H]` `logfire-instrumentation` and `observability-and-instrumentation` both fire on bare "add observability/tracing/monitoring/logging". → scope logfire to explicit Logfire mentions; let the vendor-neutral skill own generic verbs and cross-link once a backend is chosen.
- [x] **USE-8** `[H]` `phylogenetics` vs `phylogenetics-builder` overlap heavily (both MAFFT + IQ-TREE2 ML) and share the same `IQ-TREE` alias. → differentiate (library/tutorial vs one-command runner), remove the duplicate alias from one, or merge.
- [x] **USE-9** `[H]` `constant-time-analysis` vs `constant-time-testing` — near-identical crypto/timing triggers despite being a runnable static analyzer vs a tool-survey/methodology. → differentiate by method in name/description + cross-link.
- [x] **USE-10** `[M]` Two skill-discovery skills (`find-skills`, `skills-hub`) both trigger on "find a skill for"; skill-creation skills (`skill-builder`, `autoskill`, `clawpathy-autoresearch`, `plugin-creator`) all fire on authoring intent; `dynamic-resources` near-homonyms `get-available-resources`. → scope `skills-hub` to bioinformatics/BioClaw, reserve `find-skills` for the general ecosystem; add "use this vs X" lines to the creation skills.
- [x] **USE-11** `[M]` **Structure-prediction cluster (7):** `struct-predictor`, `boltz2-nim`, `colabfold`, `openfold2/3-nim`, `esm`, `structural-biology` — only `colabfold` has a Routing section; the two Boltz-2 skills don't cross-reference. → shared routing block (local-vs-NIM, monomer-vs-complex, retrieve-vs-predict); cross-link `struct-predictor` (local CLI) and `boltz2-nim` (hosted, affinity).
- [x] **USE-12** `[M]` **Code-review & debugging clusters:** 6 review skills (`code-review-and-quality`, `requesting/receiving-code-review`, `check-pr`, `greploop`, gstack review) + a 3-way debugging choice, plus generic "-and-" methodology skills whose "use when making any change" triggers fire on everything. → mutually-exclusive "use this NOT that" one-liners; tighten generic triggers to concrete moments/artifacts.
- [x] **USE-13** `[M]` **Manuscript evaluation & authoring:** 4 confusable evaluators (`peer-review`, `scientific-critical-thinking`, `scholar-evaluation`, `pre-submission-reviewer`) + two parallel authoring stacks (generic `scientific-writing` family vs the 11-skill `bio-manuscript` pipeline). → scope `scientific-critical-thinking` to critiquing published lit/GRADE (unique content, NOT a peer-review dup); route life-sciences planning to the bio pipeline and general drafting to `scientific-writing`, cross-linking.
- [x] **USE-14** `[M]` `tdd` vs `test-driven-development` — near-identical red-green-refactor; the latter is the fuller superset. → consolidate onto `test-driven-development` + alias `tdd`, or give `tdd` a disjoint "quick inline" trigger.
- [x] **USE-15** `[M]` `claw-metagenomics` vs `metagenomics` overlap (Bracken + HUMAnN + AMR) and can co-activate — NOT strict duplicates (claw adds WHO-critical-ARG resistome + single-command runner; `metagenomics` is host-depletion-aware). → re-scope/disambiguate (state each niche in line 1), don't deprecate.
- [x] **USE-16** `[M]` **PGx-report cluster** (`pharmgx-reporter`, `drug-photo`, `clinpgx`, `wes-*` PGx sections) all cover CPIC gene-drug guidance with no trigger-level distinction; four mass-spec proteomics skills form a confusable cluster where `proteomics` fails to self-disambiguate. → "use this instead of X when" lines (offline DTC report vs live API vs image-triggered card); give `proteomics` a cross-routing block (QC → pyopenms / proteomics-de / fragpipe).
- [x] **USE-17** `[M]` `caveman-review`/`-commit` and caveman mode declare broad auto-triggers ("code review", "write a commit", "auto-triggers when staging changes") that hijack normal workflows and collide with dedicated review/commit/git skills; the 7-skill caveman family is also miscategorized under Reasoning/Ideation. → narrow triggers to explicit opt-in (slash form / active mode), drop unqualified auto-trigger clauses, move the family to a workflow/output-efficiency map.
- [x] **USE-18** `[L]` `geomaster` is an overbroad "kitchen-sink" geospatial skill competing with focused `geopandas`; `fitness-nutrition` is a consumer gym/calorie tool misfiled under Clinical/Medical/Pharmacogenomics. → narrow `geomaster` to its remote-sensing niche + route vector work to `geopandas`; reassign `fitness-nutrition` to a consumer-health map.
- [x] **USE-19** `[L]` Several language-agnostic testing skills (`assertion-quality`, `test-anti-patterns`, `code-testing-agent`, …) are catalogued inside the .NET map (inviting over-matching); `morph-ppt-3d` lacks the trigger keywords/DO-NOT clauses its sibling `morph-ppt` has. → tag cross-language testing skills or move to a shared testing map; add triggers + a DO-NOT clause to `morph-ppt-3d`.

---

## Verification

These claims were re-checked by hand against the files and confirmed:

| Claim | Check |
|---|---|
| `nature-shared/` absent, referenced by 3 nature-* skills | ✔ no dir; refs in `nature-writing`/`nature-reader`/`nature-paper2ppt` |
| `dynamic-resources` / `repro-enforcer` are stubs | ✔ placeholder body; "Planned — Week 6" + only SKILL.md |
| `graphify.backup-*` in `~/.claude/skills` (not the vault) | ✔ |
| README "23" vs index "24"/"1308 skills" | ✔ `README.md:73`, `index.md:11` |
| `gget search pubmed/biorxiv` present in `literature-review` | ✔ lines 97-98, 304, 322 |
| `skill-lock.json` 385 entries vs 1253 on-disk dirs | ✔ |
| `pufferlib` unpinned `uv pip install pufferlib` | ✔ `SKILL.md:425` |

## Coverage caveats

- Large domains (`software-dev` ~97, `.NET` ~100, `web-automation-frontend` 44, `drug-discovery-chem` 46) were **sampled** (~18-22 skills each), not read exhaustively.
- The 504 expert personas were audited **as a class**, not individually — individually they're high quality; the issues are collective (index bloat, tool-skill collisions).
- Deprecations/high-severity items passed an adversarial verify pass; medium/low structural items reflect single-agent findings — confirm against the file before acting.
