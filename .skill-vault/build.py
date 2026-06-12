#!/usr/bin/env python3
"""Build the human-navigation layer for the skills vault.

Generates, for every skill folder that contains a SKILL.md:
  - <skill>.md            a root-level wrapper note (safe to hand-edit; the
                          "Personal notes" section AND your frontmatter edits
                          to status / rating / aliases are preserved on re-run)
  - maps/<domain>.md      one map (MOC) note per domain, linking to wrappers
  - index.md              master index linking to maps + every wrapper (A-Z)

The original <skill>/SKILL.md files are never touched, so an external skills
CLI can keep managing them remotely. Hand-authored files (skills.base,
recipes/*, README.md, .obsidian/*) are also never touched.

Usage:  python3 .skill-vault/build.py
"""
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS_DIR = os.path.join(ROOT, "maps")
TODAY = date.today().isoformat()
# one-time: regenerate aliases even if a wrapper already has an aliases key.
# Do NOT use after you have hand-curated aliases.
FORCE_ALIASES = "--force-aliases" in sys.argv
# delete root wrapper notes whose skill folder no longer exists (orphans).
PRUNE = "--prune" in sys.argv
# rewrite .obsidian/graph.json color groups + filter (run with the graph CLOSED,
# or Obsidian will overwrite it from memory).
GRAPH = "--graph" in sys.argv

# distinct graph colors per domain (24-bit RGB ints), keyed by category key.
PALETTE = {
    "genomics-variants": 15079755, "single-cell-rnaseq": 3978315,
    "proteomics-metabolomics": 16769305, "drug-discovery-chem": 4416472,
    "sequence-phylogenetics": 16089649, "bio-databases-platforms": 9510580,
    "clinical-medical": 4379892, "imaging-signals": 15741670, "ml-ai": 12578629,
    "data-science-compute": 16432852, "quantum-physics": 4626832,
    "research-writing": 14466815, "academic-pipelines": 10117924,
    "literature-discovery": 16775880, "documents-office": 8388608,
    "cloud-devops": 11206595, "vault-meta": 8421376, "reasoning-ideation": 117,
    "web-automation-frontend": 5832703, "analytics-engineering": 16753920,
    "security-auditing": 13382451, "software-dev": 1752220,
}
GRAPH_SEARCH = "tag:#skill OR tag:#skill-map OR tag:#recipe OR tag:#moc"
PERSONAL_MARKER = "%% ---8<--- personal notes below are preserved on re-run ---8<--- %%"

# acronyms too generic to be useful aliases
STOP = {"API", "CLI", "ML", "AI", "QC", "DNA", "RNA", "GPU", "CPU", "PDF", "CSV",
        "JSON", "HTML", "REST", "SDK", "LLM", "GO", "3D", "2D", "ID", "OS", "UI",
        "NGS", "PCA", "URL", "HTTP", "IO", "OK", "FAIR"}

# Curated human search terms that a fuzzy finder would NOT match as a subsequence
# of the skill id (the only aliases worth hard-coding). Extend freely; on rebuild,
# these only apply to skills that don't yet have an `aliases:` key.
SYNONYMS = {
    "pydeseq2": ["DESeq2"], "rnaseq-de": ["DESeq2", "edgeR"],
    "variant-annotation": ["VEP"], "vcf-annotator": ["VEP"],
    "scanpy": ["single cell", "scRNA-seq"], "scvi-tools": ["scVI", "scANVI"],
    "cellxgene-census": ["CELLxGENE"], "gwas-pipeline": ["PLINK", "REGENIE"],
    "struct-predictor": ["Boltz", "AlphaFold"], "esm": ["ESMFold", "ESM3"],
    "molecular-dynamics": ["OpenMM", "GROMACS"], "proteomics-de": ["MaxQuant", "DIA-NN"],
    "pyopenms": ["OpenMS"], "phylogenetics": ["IQ-TREE", "MAFFT"],
    "phylogenetics-builder": ["IQ-TREE"], "nextflow": ["nf-core"],
    "hf-cli": ["huggingface", "hugging face"], "transformers": ["huggingface"],
    "optimize-for-gpu": ["CUDA", "cuDF"], "methylation-clock": ["epigenetic age"],
    "umap-learn": ["UMAP"], "geopandas": ["GIS"], "pysam": ["samtools"],
    "ncbi-datasets": ["NCBI"], "literature-review": ["systematic review"],
    "consciousness-council": ["panel", "council"], "diffdock": ["docking"],
    "spatialdata-squidpy": ["SpatialData", "Squidpy", "Visium", "Xenium"],
    "harmonypy": ["Harmony"], "scirpy-immune-repertoire": ["Scirpy", "TCR", "BCR"],
    "pybedtools": ["BEDTools"], "colabfold": ["AlphaFold2", "ColabFold"],
    "fragpipe-pyteomics-proteomics": ["FragPipe", "MSFragger", "Pyteomics"],
    "cellpose-stardist-bioimage": ["Cellpose", "StarDist"],
    "monai-medical-imaging-ai": ["MONAI"], "llm-observability-evals": ["Langfuse", "Phoenix"],
    "llm-agent-security-redteam": ["OWASP LLM Top 10", "prompt injection"],
    "xarray-pandera-duckdb": ["xarray", "Pandera", "DuckDB"],
    "ngs-cli-toolkit": ["samtools", "bcftools", "bwa", "GATK", "minimap2", "plink2"],
    "seurat": ["Seurat", "single cell", "scRNA-seq"],
    "optuna": ["hyperparameter optimization", "HPO", "hyperparameter tuning", "Bayesian optimization"],
    "adjusttext": ["adjustText", "ggrepel", "label placement", "text labels"],
    "conda-bioconda": ["conda", "mamba", "micromamba", "Bioconda"],
    "github-actions-ci": ["GitHub Actions", "CI/CD", "workflows"],
    "test-driven-development": ["TDD"], "using-git-worktrees": ["git worktree"],
    "web-artifacts-builder": ["artifacts", "shadcn"],
    "opensrc": ["source code", "package source", "dependency source", "read library source"],
    "greploop": ["Greptile", "PR review loop"], "check-pr": ["PR review", "merge request", "Greptile"],
}

# ---------------------------------------------------------------------------
# Domain definition: ordered. key -> (title, scope, related_keys, [skills])
# ---------------------------------------------------------------------------
CATEGORIES = [
    ("genomics-variants", "Genomics, Variants & Population Genetics",
     "DNA sequencing, variant calling/annotation, GWAS, fine-mapping, and population & personal genomics.",
     ["single-cell-rnaseq", "sequence-phylogenetics", "bio-databases-platforms", "clinical-medical"],
     ["variant-annotation", "vcf-annotator", "clinical-variant-reporter", "gwas-pipeline",
      "gwas-lookup", "gwas-prs", "gwas-catalog-region-fetch", "fine-mapping",
      "mendelian-randomisation", "ld-1000g-region-compute", "eqtl-catalogue-region-fetch",
      "ukb-ppp-region-fetch", "locuscompare-region-render", "hla-typing", "archaic-introgression",
      "dnasp", "fastreer", "tiledbvcf", "pysam", "wgs-prs", "sample-qc-triage", "equity-scorer",
      "claw-ancestry-pca", "genome-compare", "genome-match", "recombinator", "soul2dna",
      "geniml", "gtars", "polars-bio", "nfcore-sarek-wrapper", "pacsomatic",
      "marker-dominance-mapper", "pybedtools"]),

    ("single-cell-rnaseq", "Single-Cell, RNA-seq & Functional Genomics",
     "scRNA-seq and bulk RNA-seq pipelines, differential expression, and pathway/network analysis.",
     ["genomics-variants", "proteomics-metabolomics", "sequence-phylogenetics", "bio-databases-platforms"],
     ["scanpy", "anndata", "scvi-tools", "scvelo", "cellxgene-census", "scrna-embedding",
      "scrna-orchestrator", "nfcore-scrnaseq-wrapper", "bulk-rnaseq", "rnaseq-de", "pydeseq2",
      "nfcore-rnaseq-wrapper", "rare-disease-rnaseq", "de-summary", "diff-visualizer", "arboreto",
      "deeptools", "pathway-enricher", "pathway-enrichment", "spatialdata-squidpy",
      "harmonypy", "scirpy-immune-repertoire", "seurat"]),

    ("proteomics-metabolomics", "Proteomics & Metabolomics",
     "Mass-spec and affinity proteomics, metabolomics spectral analysis, and glycoengineering.",
     ["single-cell-rnaseq", "drug-discovery-chem", "sequence-phylogenetics"],
     ["proteomics-de", "proteomics-clock", "affinity-proteomics", "pyopenms", "matchms",
      "glycoengineering", "fragpipe-pyteomics-proteomics"]),

    ("drug-discovery-chem", "Drug Discovery, Cheminformatics & Structural Biology",
     "Small-molecule and protein modeling: cheminformatics, docking, structure prediction, and target validation.",
     ["proteomics-metabolomics", "sequence-phylogenetics", "bio-databases-platforms", "ml-ai"],
     ["rdkit", "datamol", "deepchem", "molfeat", "medchem", "pytdc", "torchdrug", "diffdock",
      "struct-predictor", "esm", "molecular-dynamics", "cobrapy", "rowan", "adaptyv",
      "target-validation-scorer", "drug-repurposing-screen", "depmap", "crispr-screen-triage",
      "omics-target-evidence-mapper", "colabfold", "vmd-mdanalysis-viz"]),

    ("sequence-phylogenetics", "Sequence Analysis, NGS & Phylogenetics",
     "Sequence toolkits, read QC/alignment, phylogenetic inference, and sequence-to-function models.",
     ["genomics-variants", "single-cell-rnaseq", "bio-databases-platforms"],
     ["biopython", "bioservices", "gget", "scikit-bio", "phylogenetics", "phylogenetics-builder",
      "etetoolkit", "busco-assessor", "analyze-fasta", "seq-wrangler", "multiqc-reporter",
      "bioqc-mcp", "claw-metagenomics", "ncbi-datasets", "bioconductor-bridge",
      "gi-annotation", "gi-chromatin", "gi-enhancer", "gi-expression", "gi-promoter", "gi-splice",
      "ngs-cli-toolkit"]),

    ("bio-databases-platforms", "Bio Databases, Lab & Cloud Platforms",
     "Biomedical databases, knowledge graphs, ELNs, lab automation, and bioinformatics cloud platforms.",
     ["genomics-variants", "sequence-phylogenetics", "clinical-medical", "cloud-devops"],
     ["database-lookup", "primekg", "turingdb-graph", "clinpgx", "article-data-fetcher",
      "ukb-navigator", "galaxy-bridge", "flow-bio", "dnanexus-integration", "latchbio-integration",
      "benchling-integration", "labstep", "labarchive-integration", "omero-integration", "lamindb",
      "protocols-io", "protocolsio-integration", "ginkgo-cloud-lab", "opentrons-integration",
      "pylabrobot", "illumina-bridge", "bigquery-public"]),

    ("clinical-medical", "Clinical, Medical & Pharmacogenomics",
     "Clinical reporting, decision support, trials, pharmacogenomics, and patient-facing genomic reports.",
     ["genomics-variants", "bio-databases-platforms", "imaging-signals"],
     ["clinical-reports", "clinical-decision-support", "treatment-plans", "clinical-trial-finder",
      "wes-clinical-report-en", "wes-clinical-report-es", "pharmgx-reporter", "nutrigx-advisor",
      "drug-photo", "pyhealth", "iso-13485-certification", "profile-report", "methylation-clock"]),

    ("imaging-signals", "Imaging, Microscopy & Biosignals",
     "Microscopy and pathology images, medical imaging, electrophysiology, flow cytometry, and biosignals.",
     ["clinical-medical", "ml-ai", "bio-databases-platforms"],
     ["cell-detection", "histolab", "pathml", "pydicom", "neuropixels-analysis", "flowio",
      "neurokit2", "bids", "imaging-data-commons", "cellpose-cell-segmentation",
      "cellpose-stardist-bioimage", "monai-medical-imaging-ai", "napari-viz"]),

    ("ml-ai", "Machine Learning & AI",
     "General ML/DL frameworks, model interpretability, RL, graph learning, and scientific model hubs.",
     ["data-science-compute", "drug-discovery-chem", "cloud-devops"],
     ["scikit-learn", "pytorch-lightning", "transformers", "shap", "stable-baselines3", "pufferlib",
      "pufferlib-v2", "pufferlib-v3", "torch-geometric", "umap-learn", "aeon", "timesfm-forecasting", "hugging-science",
      "optuna"]),

    ("data-science-compute", "Data Science, Stats & Scientific Computing",
     "DataFrames, big-data tooling, statistics, optimization, simulation, geospatial, and plotting.",
     ["ml-ai", "quantum-physics", "research-writing", "analytics-engineering"],
     ["polars", "dask", "vaex", "zarr-python", "networkx", "sympy", "matlab", "statsmodels",
      "statistical-analysis", "scikit-survival", "pymc", "pymoo", "simpy", "geomaster", "geopandas",
      "exploratory-data-analysis", "optimize-for-gpu", "usfiscaldata", "matplotlib", "seaborn",
      "adjusttext",
      "xarray", "pandera-validation", "xarray-pandera-duckdb", "attach-db", "duckdb-docs",
      "install-duckdb", "query", "read-file", "paraview", "ttk-viz"]),

    ("quantum-physics", "Quantum, Physics & Materials",
     "Quantum computing frameworks, open quantum systems, astronomy, fluid dynamics, and materials science.",
     ["data-science-compute", "ml-ai"],
     ["qiskit", "cirq", "pennylane", "qutip", "astropy", "fluidsim", "pymatgen"]),

    ("research-writing", "Scientific Writing, Figures & Publishing",
     "Manuscript writing, figures and schematics, posters/slides, reference management, and pre-submission review.",
     ["academic-pipelines", "literature-discovery", "documents-office", "reasoning-ideation",
      "web-automation-frontend"],
     ["scientific-writing", "scientific-visualization", "scientific-slides", "scientific-schematics",
      "scientific-critical-thinking", "citation-management", "peer-review", "research-grants",
      "venue-templates", "latex-posters", "pptx-posters", "paper-2-web", "markdown-mermaid-writing",
      "figure-designer", "scholar-evaluation", "tech-paper-template", "benchmark-paper-template",
      "intro-drafter", "pre-submission-reviewer", "pyzotero"]),

    ("academic-pipelines", "Academic Paper & Nature Pipelines",
     "End-to-end multi-agent paper pipelines and the Nature-family writing/review/translation suite.",
     ["research-writing", "literature-discovery", "reasoning-ideation"],
     ["academic-paper", "academic-paper-reviewer", "academic-pipeline", "deep-research",
      "nature-academic-search", "nature-citation", "nature-data", "nature-figure", "nature-paper2ppt",
      "nature-polishing", "nature-reader", "nature-response", "nature-reviewer", "nature-writing"]),

    ("literature-discovery", "Literature Search & Knowledge Discovery",
     "Paper search across databases, web research, content extraction, and knowledge bases.",
     ["research-writing", "academic-pipelines", "documents-office"],
     ["paper-lookup", "pubmed-summariser", "lit-synthesizer", "research-lookup", "exa-search",
      "parallel-web", "bgpt-mcp", "bgpt-paper-search", "paperzilla", "open-notebook", "defuddle",
      "literature-review", "data-extractor", "claw-semantic-sim"]),

    ("documents-office", "Documents, Office & Media",
     "Office document toolkits (docx/pptx/pdf/xlsx), file-to-markdown conversion, and image/report generation.",
     ["research-writing", "literature-discovery"],
     ["docx", "pptx", "pdf", "xlsx", "markitdown", "liteparse", "infographics", "generate-image",
      "market-research-reports", "doc-coauthoring", "internal-comms"]),

    ("cloud-devops", "Cloud, Infra & MLOps",
     "AWS architecture and operations, serverless GPU compute, developer infrastructure, the Hugging Face CLI, and workflow pipelines.",
     ["ml-ai", "bio-databases-platforms", "vault-meta", "analytics-engineering", "security-auditing", "software-dev"],
     ["aws-agentic-ai", "aws-cdk-development", "aws-cost-operations", "aws-mcp-setup",
      "aws-serverless-eda", "modal", "hf-cli", "nextflow", "snakemake-workflow-engine",
      "e2b-sandbox", "devcontainer-setup", "modern-python", "conda-bioconda",
      "ci-cd-and-automation", "shipping-and-launch"]),

    ("software-dev", "Software Development & Engineering",
     "General software-engineering methodology and tooling: TDD, debugging, code review, planning, git worktrees, source-grounded implementation, plus core app primitives (pytest, Docker, FastAPI, CI).",
     ["vault-meta", "security-auditing", "cloud-devops", "reasoning-ideation"],
     ["test-driven-development", "systematic-debugging", "verification-before-completion",
      "requesting-code-review", "receiving-code-review", "brainstorming", "writing-plans",
      "executing-plans", "subagent-driven-development", "dispatching-parallel-agents",
      "finishing-a-development-branch", "using-git-worktrees", "using-superpowers",
      "using-agent-skills", "writing-skills", "api-and-interface-design",
      "code-review-and-quality", "code-simplification", "context-engineering",
      "debugging-and-error-recovery", "deprecation-and-migration", "documentation-and-adrs",
      "doubt-driven-development", "git-workflow-and-versioning", "incremental-implementation",
      "planning-and-task-breakdown", "source-driven-development", "spec-driven-development",
      "pytest", "jest", "vitest", "docker", "fastapi", "github-actions-ci", "opensrc", "check-pr", "greploop",
      "linear"]),

    ("vault-meta", "Vault, Skills & Workflow Meta",
     "Obsidian authoring, skill building/discovery, reproducibility, orchestration, and resource detection.",
     ["cloud-devops", "reasoning-ideation", "security-auditing", "software-dev"],
     ["obsidian-markdown", "obsidian-bases", "obsidian-cli", "json-canvas", "skill-builder",
      "find-skills", "autoskill", "clawpathy-autoresearch", "repro-enforcer", "bio-orchestrator",
      "get-available-resources", "mcp-builder", "auditing-skills"]),

    ("reasoning-ideation", "Reasoning, Ideation & Decision",
     "Multi-perspective deliberation, brainstorming, hypothesis generation, idea evaluation, and scenario analysis.",
     ["research-writing", "academic-pipelines", "vault-meta"],
     ["consciousness-council", "what-if-oracle", "dhdna-profiler", "scientific-brainstorming",
      "hypothesis-generation", "idea-evaluator", "idea-refine", "interview-me",
      "vibe-research-workflow", "hypogenic"]),

    ("web-automation-frontend", "Web Automation, Frontend & Design",
     "Browser automation, Playwright testing, frontend design guidance, React/Next.js patterns, Figma workflows, and design-to-code loops.",
     ["cloud-devops", "documents-office", "research-writing", "analytics-engineering"],
     ["agent-browser", "agentcore", "core", "dogfood", "electron", "slack", "vercel-sandbox",
      "playwright-cli", "playwright-best-practices", "webapp-testing", "frontend-design",
      "browser-testing-with-devtools", "frontend-ui-engineering", "performance-optimization",
      "web-design-guidelines", "vercel-composition-patterns", "vercel-react-best-practices",
      "vercel-react-view-transitions", "figma-use", "figma-generate-design",
      "figma-generate-library", "figma-implement-design", "web-artifacts-builder",
      "brand-guidelines", "theme-factory", "algorithmic-art"]),

    ("analytics-engineering", "Analytics Engineering & LLM Operations",
     "dbt analytics engineering, semantic layers, warehouse querying, lineage diagrams, LLM observability, prompt tracing, and evaluation workflows.",
     ["data-science-compute", "cloud-devops", "ml-ai", "security-auditing"],
     ["adding-dbt-unit-test", "answering-natural-language-questions-with-dbt",
      "building-dbt-semantic-layer", "configuring-dbt-mcp-server", "creating-mermaid-dbt-dag",
      "fetching-dbt-docs", "running-dbt-commands", "troubleshooting-dbt-job-errors",
      "using-dbt-for-analytics-engineering", "working-with-dbt-mesh",
      "migrating-dbt-core-to-fusion", "migrating-dbt-project-across-platforms",
      "langfuse", "phoenix-cli", "phoenix-evals", "llm-observability-evals",
      "observability-and-instrumentation"]),

    ("security-auditing", "Security & Auditing",
     "Secure development, code auditing, static analysis, SARIF, fuzzing, agent security, supply-chain risk, and smart-contract review helpers.",
     ["cloud-devops", "vault-meta", "analytics-engineering", "web-automation-frontend"],
     ["llm-agent-security-redteam", "audit-context-building", "audit-prep-assistant",
      "code-maturity-assessor", "secure-workflow-guide", "differential-review", "gh-cli",
      "codeql", "sarif-parsing", "semgrep", "semgrep-rule-creator", "property-based-testing",
      "c-review", "constant-time-analysis", "constant-time-testing", "harness-writing",
      "coverage-analysis", "fuzzing-dictionary", "fuzzing-obstacles", "libfuzzer",
      "cargo-fuzz", "atheris", "ossfuzz", "aflpp", "supply-chain-risk-auditor",
      "agentic-actions-auditor", "insecure-defaults", "sharp-edges", "variant-analysis",
      "zeroize-audit", "fp-check", "guidelines-advisor", "entry-point-analyzer",
      "token-integration-analyzer", "spec-to-code-compliance", "security-and-hardening"]),
]


# ---------------------------------------------------------------------------
def read_description(skill):
    path = os.path.join(ROOT, skill, "SKILL.md")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return None
    fm = m.group(1)
    desc_lines, capturing = [], False
    for line in fm.splitlines():
        if not capturing:
            km = re.match(r"^description:\s*(.*)$", line)
            if km:
                capturing = True
                rest = km.group(1).strip()
                if rest and rest not in (">", "|", ">-", "|-"):
                    desc_lines.append(rest)
        else:
            if re.match(r"^[A-Za-z0-9_-]+:(\s|$)", line) or line.strip() == "---":
                break
            desc_lines.append(line.strip())
    desc = " ".join(p for p in desc_lines if p).strip().strip("'\"").strip()
    return " ".join(desc.split()) or None


def one_liner(desc, limit=185):
    if not desc:
        return "(no description)"
    parts = re.split(r"(?<=[.;])\s+", desc)
    out = ""
    for p in parts:
        out = (out + " " + p).strip() if out else p
        if len(out) >= 40:
            break
    out = " ".join(out.split()).rstrip(" .;,")
    if len(out) > limit:
        out = out[:limit].rsplit(" ", 1)[0].rstrip(" .;,") + "..."
    return out


def gen_aliases(skill, desc):
    """Search synonyms: curated terms + spaced id + tool acronyms in the FIRST sentence."""
    al = list(SYNONYMS.get(skill, []))
    if "-" in skill:
        al.append(skill.replace("-", " "))
    first = re.split(r"(?<=[.;])\s+", desc or "", maxsplit=1)[0] if desc else ""
    for m in re.finditer(r"\(([^)]{1,40})\)", first):
        for tok in re.split(r"[,/]| or | and ", m.group(1)):
            tok = tok.strip()
            if (re.fullmatch(r"[A-Za-z][A-Za-z0-9.+-]{1,14}", tok)
                    and any(c.isupper() for c in tok)
                    and tok.upper() not in STOP
                    and tok.lower() != skill.lower()):
                al.append(tok)
    seen, out = set(), []
    for a in al:
        if a.lower() not in seen:
            seen.add(a.lower()); out.append(a)
    return out[:5]


def discover_skills():
    found = set()
    for name in os.listdir(ROOT):
        if name.startswith("."):
            continue
        p = os.path.join(ROOT, name)
        if os.path.isdir(p) and os.path.isfile(os.path.join(p, "SKILL.md")):
            found.add(name)
    return found


# Skill ids that are common English words — their whole-word match against other
# skills' descriptions produces spurious edges (e.g. "linear" matching "linear algebra"
# in matlab/shap/sympy). They are never used as a search pattern against *other*
# descriptions; they still gain edges when a specific skill name appears in their own.
GENERIC_NAMES = {"linear", "core", "query", "find-skills"}


def build_related(skills, full_desc):
    patterns = {s: re.compile(r"(?<![\w-])" + re.escape(s) + r"(?![\w-])", re.IGNORECASE)
                for s in skills}
    edges = {s: set() for s in skills}
    for s in skills:
        d = full_desc.get(s) or ""
        if not d:
            continue
        for t in skills:
            if t != s and t not in GENERIC_NAMES and patterns[t].search(d):
                edges[s].add(t); edges[t].add(s)
    return edges


def parse_existing(skill):
    """Read user-editable bits from an existing wrapper so re-runs preserve them."""
    path = os.path.join(ROOT, skill + ".md")
    if not os.path.isfile(path):
        return None
    txt = open(path, encoding="utf-8").read()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", txt, re.DOTALL)
    fm = m.group(1) if m else ""
    data = {}
    for key in ("created", "status", "rating"):
        km = re.search(rf"^{key}:\s*(.+)$", fm, re.MULTILINE)
        if km:
            data[key] = km.group(1).strip()
    # None => no aliases key at all (auto-generate); [] => user set it empty (respect)
    aliases = None
    block = re.search(r"^aliases:\s*\n((?:[ \t]*-[ \t].*\n?)+)", fm, re.MULTILINE)
    inline = re.search(r"^aliases:\s*\[(.*)\]\s*$", fm, re.MULTILINE)
    empty = re.search(r"^aliases:\s*(\[\s*\]|)\s*$", fm, re.MULTILINE)
    if block:
        aliases = []
        for line in block.group(1).splitlines():
            lm = re.match(r"[ \t]*-[ \t]+(.*)$", line)
            if lm:
                aliases.append(lm.group(1).strip().strip("'\""))
    elif inline:
        aliases = [a.strip().strip("'\"") for a in inline.group(1).split(",") if a.strip()]
    elif empty:
        aliases = []
    data["aliases"] = aliases
    idx = txt.find(PERSONAL_MARKER)
    data["personal"] = txt[idx:] if idx != -1 else None
    return data


def emit_alias_block(aliases):
    if not aliases:
        return []
    out = ["aliases:"]
    for a in aliases:
        out.append(f'  - "{a}"' if re.search(r'[:#\[\],&*?{}|<>=!%@`"]', a) else f"  - {a}")
    return out


def update_graph():
    """Rewrite graph.json color groups + filter, preserving all other settings."""
    import json
    path = os.path.join(ROOT, ".obsidian", "graph.json")
    cfg = {}
    if os.path.isfile(path):
        try:
            cfg = json.load(open(path, encoding="utf-8"))
        except (OSError, ValueError):
            cfg = {}
    if cfg.get("close") is False:
        print("WARNING: graph.json says the Graph view is OPEN; close it first or "
              "Obsidian may overwrite these colors.", file=sys.stderr)
    cfg["search"] = GRAPH_SEARCH
    cfg["showOrphans"] = False
    cfg["colorGroups"] = [
        {"query": f"tag:#domain/{key}", "color": {"a": 1, "rgb": PALETTE[key]}}
        for key, *_ in CATEGORIES if key in PALETTE
    ]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    print(f"graph.json: wrote {len(cfg['colorGroups'])} color groups + filter")


def main():
    os.makedirs(MAPS_DIR, exist_ok=True)
    if GRAPH:
        update_graph()
    title_by_key = {k: t for k, t, _, _, _ in CATEGORIES}
    key_by_skill, assigned = {}, {}
    for key, title, scope, related, skills in CATEGORIES:
        for s in skills:
            if s in assigned:
                print(f"WARNING: {s} in both {assigned[s]} and {key}", file=sys.stderr)
            assigned[s] = key
            key_by_skill[s] = key

    on_disk = discover_skills()
    unsorted = sorted(on_disk - set(assigned))
    if unsorted:
        print(f"WARNING: not categorized: {unsorted}", file=sys.stderr)
    for s in unsorted:
        key_by_skill[s] = "uncategorized"

    skills_sorted = sorted(on_disk)
    full_desc = {s: read_description(s) for s in skills_sorted}
    short = {s: one_liner(full_desc[s]) for s in skills_sorted}
    related = build_related(skills_sorted, full_desc)

    # ---- wrapper notes -----------------------------------------------------
    for s in skills_sorted:
        key = key_by_skill.get(s, "uncategorized")
        dtitle = title_by_key.get(key, "Uncategorized")
        ex = parse_existing(s)
        if ex:
            created = ex.get("created", TODAY)
            status = ex.get("status", "untried")
            rating = ex.get("rating")
            aliases = ex.get("aliases")
            if aliases is None or FORCE_ALIASES:  # key absent => first-time auto-generate
                aliases = gen_aliases(s, full_desc[s])
            personal = ex.get("personal")
        else:
            created, status, rating = TODAY, "untried", None
            aliases = gen_aliases(s, full_desc[s])
            personal = None

        L = ["---", f"title: {s}"]
        L += emit_alias_block(aliases)
        L += ["tags:", "  - skill"]
        if key != "uncategorized":
            L.append(f"  - domain/{key}")
        if key != "uncategorized":
            L.append(f"domain: {key}")
        L.append(f"status: {status}")
        if rating is not None:
            L.append(f"rating: {rating}")
        L.append(f"source: {s}/SKILL.md")
        L.append(f"created: {created}")
        L += ["---", "", f"# {s}", "", "> [!info] What it does",
              f"> {full_desc[s] or '(no description)'}", ""]
        nav = [f"**Source:** [{s}/SKILL.md]({s}/SKILL.md)"]
        if key != "uncategorized":
            nav.append(f"**Domain:** [{dtitle}](maps/{key}.md)")
        nav += ["**Table:** [skills.base](skills.base)", "**Index:** [Skills Index](index.md)"]
        L += ["  ·  ".join(nav), "", "## Related skills", ""]
        rel = sorted(related.get(s, []))
        if rel:
            L += [f"- [{r}]({r}.md) — {short[r]}" for r in rel]
        else:
            L.append("_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._")
        L.append("")
        if personal:
            L.append(personal.rstrip() + "\n")
        else:
            L += [PERSONAL_MARKER, "", "## Notes", "", ""]
        with open(os.path.join(ROOT, s + ".md"), "w", encoding="utf-8") as f:
            f.write("\n".join(L))

    # ---- map notes ---------------------------------------------------------
    for key, title, scope, related_keys, skills in CATEGORIES:
        live = sorted(s for s in skills if s in on_disk)
        L = ["---", f"title: {title}", "tags:", "  - skill-map", f"created: {TODAY}", "---", "",
             f"# {title}", "", "> [!abstract] Scope", f"> {scope}", "",
             "[Back to Skill Index](../index.md)", ""]
        rel = [f"[{title_by_key[r]}]({r}.md)" for r in related_keys if r in title_by_key]
        if rel:
            L += ["**Related maps:** " + " | ".join(rel), ""]
        L += [f"## Skills ({len(live)})", ""]
        L += [f"- [{s}](../{s}.md) — {short[s]}" for s in live]
        L.append("")
        with open(os.path.join(MAPS_DIR, f"{key}.md"), "w", encoding="utf-8") as f:
            f.write("\n".join(L))

    # ---- index -------------------------------------------------------------
    total = len(on_disk)
    I = ["---", "title: Skills Index", "tags:", "  - moc", "  - skill-index",
         f"created: {TODAY}", "---", "", "# Skills Index", "",
         f"A navigable map of the **{total} agent skills** in this vault, grouped into "
         f"{len(CATEGORIES)} domains. Each entry links to a per-skill note that wraps the "
         f"original `SKILL.md` and holds your personal notes, status, and aliases.", "",
         "> [!tip] How to navigate",
         "> - **Find by name/synonym:** quick-switcher or grep (skills carry aliases like `DESeq2`, `single cell`).",
         "> - **Browse a domain:** open a map below for grouped, cross-linked skills.",
         "> - **Filter by attribute:** open [skills.base](skills.base) to sort/filter by domain, status, rating.",
         "> - **Navigate by goal:** see [Workflows & recipes](recipes/index.md).",
         "> - **See connections:** Obsidian Graph view is color-grouped by domain.", "",
         "## Quick access", "",
         "- [Filterable table — skills.base](skills.base)  ·  sort & filter all skills by domain / status / rating",
         "- [Workflows & recipes](recipes/index.md)  ·  goal-oriented chains of skills",
         "", "## Browse by domain", ""]
    for key, title, scope, related_keys, skills in CATEGORIES:
        live = sorted(s for s in skills if s in on_disk)
        I += [f"### [{title}](maps/{key}.md)  ·  {len(live)} skills", "", scope, ""]
        preview = live[:6]
        chips = ", ".join(f"[{s}]({s}.md)" for s in preview)
        more = f" … [see all {len(live)} →](maps/{key}.md)" if len(live) > len(preview) else ""
        I += [chips + more, ""]
    I += ["## All skills (A–Z)", ""]
    cur, bucket = None, []
    def flush():
        if bucket:
            I.append(" · ".join(bucket)); I.append("")
    for s in sorted(on_disk, key=str.lower):
        letter = s[0].upper()
        if letter != cur:
            flush(); bucket = []; cur = letter; I.append(f"**{letter}**")
        bucket.append(f"[{s}]({s}.md)")
    flush()
    if unsorted:
        I += ["## Uncategorized", ""]
        I += [f"- [{s}]({s}.md) — {short[s]}" for s in unsorted]
        I.append("")
    with open(os.path.join(ROOT, "index.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(I))

    # ---- prune orphaned wrappers ------------------------------------------
    pruned = []
    if PRUNE:
        keep = set(on_disk) | {"index", "README"}
        for f in os.listdir(ROOT):
            if not f.endswith(".md") or f.startswith("."):
                continue
            name = f[:-3]
            if name in keep:
                continue
            p = os.path.join(ROOT, f)
            try:
                txt = open(p, encoding="utf-8").read()
            except OSError:
                continue
            # only delete files that are clearly generated wrappers
            if re.search(r"^source:\s*.+/SKILL\.md\s*$", txt, re.MULTILINE) or PERSONAL_MARKER in txt:
                os.remove(p)
                pruned.append(name)
        if pruned:
            print(f"PRUNED {len(pruned)} orphan wrapper(s): {', '.join(sorted(pruned))}",
                  file=sys.stderr)

    edge_count = sum(len(v) for v in related.values()) // 2
    print(f"OK: {total} wrappers, {len(CATEGORIES)} maps, {edge_count} related-links, "
          f"unsorted={len(unsorted)}, pruned={len(pruned)}")


if __name__ == "__main__":
    main()
