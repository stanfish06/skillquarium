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
import stat
import sys
import tempfile
from datetime import date
from pathlib import Path

from expert_taxonomy import (
    DISPATCHER,
    EXPERT_DOMAIN,
    ExpertTaxonomy,
    ProfileAssignment,
    TaxonomyValidationError,
    load_catalog_profiles,
    load_taxonomy,
)

DEFAULT_VAULT_DIR = Path(__file__).resolve().parents[1]
VAULT_DIR = Path(
    os.environ.get("SKILL_VAULT_ROOT") or DEFAULT_VAULT_DIR
).resolve()
ROOT = str(VAULT_DIR)
MAPS_DIR = VAULT_DIR / "maps"
TAXONOMY_PATH = VAULT_DIR / ".skill-vault/scientific-expert-taxonomy.json"
CATALOG_PATH = VAULT_DIR / "scientific-agents/references/catalog.json"
EXPERT_MAPS_DIR = VAULT_DIR / "maps/scientific-expert-profiles"
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
    "scientific-expert-profiles": 10040012,
}
GRAPH_SEARCH = "tag:#skill OR tag:#skill-map OR tag:#recipe OR tag:#moc"
PERSONAL_MARKER = "%% ---8<--- personal notes below are preserved on re-run ---8<--- %%"
GENERATED_EXPERT_MARKER = "generated: scientific-expert-taxonomy"

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
    "caveman": ["plain language", "ELI5", "dumb it down", "no jargon"],
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
      "harmonypy", "scirpy-immune-repertoire", "seurat",
      "atac-seq", "chip-seq", "cell-annotation", "scrna-preprocessing-clustering",
      "differential-expression"]),

    ("proteomics-metabolomics", "Proteomics & Metabolomics",
     "Mass-spec and affinity proteomics, metabolomics spectral analysis, and glycoengineering.",
     ["single-cell-rnaseq", "drug-discovery-chem", "sequence-phylogenetics"],
     ["proteomics-de", "proteomics-clock", "affinity-proteomics", "pyopenms", "matchms",
      "glycoengineering", "fragpipe-pyteomics-proteomics",
      "proteomics", "sec-report", "sds-gel-review"]),

    ("drug-discovery-chem", "Drug Discovery, Cheminformatics & Structural Biology",
     "Small-molecule and protein modeling: cheminformatics, docking, structure prediction, and target validation.",
     ["proteomics-metabolomics", "sequence-phylogenetics", "bio-databases-platforms", "ml-ai"],
     ["rdkit", "datamol", "deepchem", "molfeat", "medchem", "pytdc", "torchdrug", "diffdock",
      "struct-predictor", "esm", "molecular-dynamics", "cobrapy", "rowan", "adaptyv",
      "target-validation-scorer", "drug-repurposing-screen", "depmap", "crispr-screen-triage",
      "omics-target-evidence-mapper", "colabfold", "vmd-mdanalysis-viz",
      "structural-biology"]),

    ("sequence-phylogenetics", "Sequence Analysis, NGS & Phylogenetics",
     "Sequence toolkits, read QC/alignment, phylogenetic inference, and sequence-to-function models.",
     ["genomics-variants", "single-cell-rnaseq", "bio-databases-platforms"],
     ["biopython", "bioservices", "gget", "scikit-bio", "phylogenetics", "phylogenetics-builder",
      "etetoolkit", "busco-assessor", "analyze-fasta", "seq-wrangler", "multiqc-reporter",
      "bioqc-mcp", "claw-metagenomics", "ncbi-datasets", "bioconductor-bridge",
      "gi-annotation", "gi-chromatin", "gi-enhancer", "gi-expression", "gi-promoter", "gi-splice",
      "ngs-cli-toolkit",
      "sequence-analysis", "blast-search", "metagenomics"]),

    ("bio-databases-platforms", "Bio Databases, Lab & Cloud Platforms",
     "Biomedical databases, knowledge graphs, ELNs, lab automation, and bioinformatics cloud platforms.",
     ["genomics-variants", "sequence-phylogenetics", "clinical-medical", "cloud-devops"],
     ["database-lookup", "primekg", "turingdb-graph", "clinpgx", "article-data-fetcher",
      "ukb-navigator", "galaxy-bridge", "flow-bio", "dnanexus-integration", "latchbio-integration",
      "benchling-integration", "labstep", "labarchive-integration", "omero-integration", "lamindb",
      "protocols-io", "protocolsio-integration", "ginkgo-cloud-lab", "opentrons-integration",
      "pylabrobot", "illumina-bridge", "bigquery-public",
      "query-alphafold", "query-clinvar", "query-ensembl", "query-geo", "query-interpro",
      "query-kegg", "query-opentarget", "query-pdb", "query-reactome", "query-stringdb",
      "query-uniprot", "bio-tools"]),

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
      "adjusttext", "build-complexheatmaps",
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
      "intro-drafter", "pre-submission-reviewer", "pyzotero",
      "bio-manuscript-pipeline", "bio-innovation-check", "bio-task-system", "bio-dataset-search",
      "bio-metric-system", "bio-analysis-system", "bio-figure-design", "bio-manuscript-text",
      "bio-human-feedback", "bio-manuscript-refine", "bio-ppt-generate"]),

    ("academic-pipelines", "Academic Paper & Nature Pipelines",
     "End-to-end multi-agent paper pipelines and the Nature-family writing/review/translation suite.",
     ["research-writing", "literature-discovery", "reasoning-ideation"],
     ["academic-paper", "academic-paper-reviewer", "academic-pipeline", "deep-research",
      "nature-academic-search", "nature-citation", "nature-data", "nature-figure", "nature-paper2ppt",
      "nature-polishing", "nature-reader", "nature-response", "nature-reviewer", "nature-writing"]),

    ("scientific-expert-profiles", "Scientific Expert Profiles",
     "Discipline-specific scientific and engineering operating profiles adapted from K-Dense scientific-agents.",
     ["research-writing", "academic-pipelines", "reasoning-ideation", "data-science-compute"],
     []),

    ("literature-discovery", "Literature Search & Knowledge Discovery",
     "Paper search across databases, web research, content extraction, and knowledge bases.",
     ["research-writing", "academic-pipelines", "documents-office"],
     ["paper-lookup", "pubmed-summariser", "lit-synthesizer", "research-lookup", "exa-search",
      "parallel-web", "bgpt-mcp", "bgpt-paper-search", "paperzilla", "open-notebook", "defuddle",
      "literature-review", "data-extractor", "claw-semantic-sim", "pubmed-search"]),

    ("documents-office", "Documents, Office & Media",
     "Office document toolkits (docx/pptx/pdf/xlsx), file-to-markdown conversion, and image/report generation.",
     ["research-writing", "literature-discovery"],
     ["docx", "pptx", "pdf", "xlsx", "markitdown", "liteparse", "infographics", "generate-image",
      "market-research-reports", "doc-coauthoring", "internal-comms", "report-template"]),

    ("cloud-devops", "Cloud, Infra & MLOps",
     "AWS architecture and operations, serverless GPU compute, developer infrastructure, the Hugging Face CLI, and workflow pipelines.",
     ["ml-ai", "bio-databases-platforms", "vault-meta", "analytics-engineering", "security-auditing", "software-dev"],
     ["aws-agentic-ai", "aws-cdk-development", "aws-cost-operations", "aws-mcp-setup",
      "aws-serverless-eda", "modal", "hf-cli", "nextflow", "snakemake-workflow-engine",
      "e2b-sandbox", "devcontainer-setup", "modern-python", "conda-bioconda",
      "docker-expert", "kubernetes-specialist", "ci-cd-and-automation", "shipping-and-launch"]),

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
      "linear", "cavekit-methodology", "cavekit-validation-first", "cavekit-revision",
      "cavekit-design-system"]),

    ("vault-meta", "Vault, Skills & Workflow Meta",
     "Obsidian authoring, skill building/discovery, reproducibility, orchestration, and resource detection.",
     ["cloud-devops", "reasoning-ideation", "security-auditing", "software-dev"],
     ["obsidian-markdown", "obsidian-bases", "obsidian-cli", "json-canvas", "skill-builder",
      "find-skills", "autoskill", "clawpathy-autoresearch", "repro-enforcer", "bio-orchestrator",
      "get-available-resources", "mcp-builder", "auditing-skills", "plugin-creator",
      "dynamic-resources", "skills-hub"]),

    ("reasoning-ideation", "Reasoning, Ideation & Decision",
     "Multi-perspective deliberation, brainstorming, hypothesis generation, idea evaluation, and scenario analysis.",
     ["research-writing", "academic-pipelines", "vault-meta"],
     ["consciousness-council", "what-if-oracle", "dhdna-profiler", "scientific-brainstorming",
      "hypothesis-generation", "idea-evaluator", "idea-refine", "interview-me",
      "vibe-research-workflow", "hypogenic", "caveman", "caveman-compress", "cavecrew", "caveman-help", "caveman-review", "caveman-stats", "caveman-commit"]),

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


def is_scientific_agents_profile(skill):
    path = os.path.join(ROOT, skill, "SKILL.md")
    if not os.path.isfile(path):
        return False
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read(4096)
    except OSError:
        return False
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return False
    fm = m.group(1)
    return bool(
        re.search(r"(?m)^\s*scientific-agents-profile:\s*true\b", fm)
        or re.search(r"(?m)^\s*source-repo:\s*K-Dense-AI/scientific-agents\b", fm)
    )


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


def build_related_excluding(skills, full_desc, excluded):
    """Build exact-name edges without allowing excluded skills to participate."""
    excluded = set(excluded)
    candidates = [skill for skill in skills if skill not in excluded]
    related = build_related(candidates, full_desc)
    for skill in skills:
        related.setdefault(skill, set())
    return related


def parse_existing(skill):
    """Read user-editable bits from an existing wrapper so re-runs preserve them."""
    path = os.path.join(ROOT, skill + ".md")
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as wrapper_file:
        txt = wrapper_file.read()
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


def existing_created(path):
    """Preserve generated note creation dates across rebuilds."""
    if not os.path.isfile(path):
        return TODAY
    try:
        with open(path, encoding="utf-8") as f:
            txt = f.read(1024)
    except OSError:
        return TODAY
    m = re.search(r"^created:\s*(.+)$", txt, re.MULTILINE)
    return m.group(1).strip() if m else TODAY


def expert_map_path(directory, discipline_id):
    """Resolve one nested map path and reject paths outside its directory."""
    root = Path(directory).resolve()
    candidate = (root / f"{discipline_id}.md").resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise TaxonomyValidationError(
            (f"discipline path escapes expert map directory: {discipline_id}",)
        ) from exc
    return candidate


def atomic_write_text(path, content):
    """Atomically replace a generated text file via a temporary sibling."""
    path = Path(path)
    mode = stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o644
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(content)
            temporary.flush()
            os.fsync(temporary.fileno())
        temporary_path.chmod(mode)
        os.replace(temporary_path, path)
    except BaseException:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


def render_expert_master_map(*, taxonomy, title, scope, created):
    """Render the scientific expert profile master map."""
    lines = [
        "---",
        f"title: {title}",
        "tags:",
        "  - skill-map",
        GENERATED_EXPERT_MARKER,
        f"created: {created}",
        "---",
        "",
        f"# {title}",
        "",
        "> [!abstract] Scope",
        f"> {scope}",
        "",
        "[Back to Skill Index](../index.md)",
        "",
        "## Profile Dispatcher",
        "",
        "- [scientific-agents](../scientific-agents.md) - Route a question "
        "to the most relevant scientific expert profile.",
        "",
        "## Browse By Discipline",
        "",
    ]
    for discipline in taxonomy.disciplines:
        primary_count = len(taxonomy.primary_profiles(discipline.id))
        cross_count = len(taxonomy.secondary_profiles(discipline.id))
        lines.append(
            f"- [{discipline.title}]"
            f"({EXPERT_DOMAIN}/{discipline.id}.md) - "
            f"{primary_count} primary, {cross_count} cross-disciplinary"
        )
    lines.append("")
    return "\n".join(lines)


def render_expert_discipline_map(
    *,
    discipline,
    taxonomy,
    short_descriptions,
    category_titles,
    bridge_domain_order,
    created,
):
    """Render one scientific expert discipline map."""
    primary = taxonomy.primary_profiles(discipline.id)
    secondary = taxonomy.secondary_profiles(discipline.id)
    bridges = taxonomy.bridge_domains_for_discipline(
        discipline.id, bridge_domain_order
    )
    lines = [
        "---",
        f"title: {discipline.title}",
        "tags:",
        "  - skill-map",
        GENERATED_EXPERT_MARKER,
        f"created: {created}",
        "---",
        "",
        f"# {discipline.title}",
        "",
        "> [!abstract] Scope",
        f"> {discipline.description}",
        "",
        "[Back to Scientific Expert Profiles](../scientific-expert-profiles.md)",
        "",
        "## Relevant capability maps",
        "",
    ]
    if bridges:
        lines += [
            f"- [{category_titles[domain]}](../{domain}.md)"
            for domain in bridges
        ]
    else:
        lines.append("_No capability maps assigned._")
    lines += ["", "## Primary experts", ""]
    if primary:
        lines += [
            f"- [{slug}](../../{slug}.md) - {short_descriptions[slug]}"
            for slug in primary
        ]
    else:
        lines.append("_No primary experts._")
    lines += ["", "## Cross-disciplinary experts", ""]
    if secondary:
        lines += [
            f"- [{slug}](../../{slug}.md) - {short_descriptions[slug]}"
            for slug in secondary
        ]
    else:
        lines.append("_No cross-disciplinary experts._")
    lines.append("")
    return "\n".join(lines)


def prune_stale_expert_maps(directory, discipline_ids):
    """Remove obsolete generated direct-child maps without touching other files."""
    current = set(discipline_ids)
    pruned = []
    for path in Path(directory).glob("*.md"):
        if not path.is_file() or path.stem in current:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        frontmatter = re.match(r"^---\s*\n(.*?)\n---(?:\s*\n|$)", text, re.DOTALL)
        if (
            frontmatter is not None
            and GENERATED_EXPERT_MARKER in frontmatter.group(1).splitlines()
        ):
            path.unlink()
            pruned.append(path.name)
    return tuple(sorted(pruned))


def emit_alias_block(aliases):
    if not aliases:
        return []
    out = ["aliases:"]
    for a in aliases:
        out.append(f'  - "{a}"' if re.search(r'[:#\[\],&*?{}|<>=!%@`"]', a) else f"  - {a}")
    return out


def render_wrapper(
    skill,
    *,
    key,
    domain_title,
    description,
    short_descriptions,
    related,
    existing,
    today,
    force_aliases,
    expert_assignment: ProfileAssignment | None = None,
    discipline_titles=None,
    category_titles=None,
    bridge_domain_order=(),
):
    """Render one wrapper without reading from or writing to the vault."""
    discipline_titles = discipline_titles or {}
    category_titles = category_titles or {}
    if existing:
        created = existing.get("created", today)
        status = existing.get("status", "untried")
        rating = existing.get("rating")
        aliases = existing.get("aliases")
        if aliases is None or force_aliases:
            aliases = gen_aliases(skill, description)
        personal = existing.get("personal")
    else:
        created, status, rating = today, "untried", None
        aliases = gen_aliases(skill, description)
        personal = None

    lines = ["---", f"title: {skill}"]
    lines += emit_alias_block(aliases)
    lines += ["tags:", "  - skill"]
    if key != "uncategorized":
        lines.append(f"  - domain/{key}")
        lines.append(f"domain: {key}")
    if expert_assignment is not None:
        lines.append(f"expert_primary: {expert_assignment.primary}")
        if expert_assignment.secondary:
            lines.append("expert_secondary:")
            lines += [f"  - {value}" for value in expert_assignment.secondary]
        lines.append("bridge_domains:")
        lines += [f"  - {value}" for value in expert_assignment.bridge_domains]
    lines.append(f"status: {status}")
    if rating is not None:
        lines.append(f"rating: {rating}")
    lines.append(f"source: {skill}/SKILL.md")
    lines.append(f"created: {created}")
    lines += [
        "---",
        "",
        f"# {skill}",
        "",
        "> [!info] What it does",
        f"> {description or '(no description)'}",
        "",
    ]

    nav = [f"**Source:** [{skill}/SKILL.md]({skill}/SKILL.md)"]
    if key != "uncategorized":
        nav.append(f"**Domain:** [{domain_title}](maps/{key}.md)")
    if expert_assignment is not None:
        primary = expert_assignment.primary
        nav.append(
            "**Primary:** "
            f"[{discipline_titles[primary]}]"
            f"(maps/{EXPERT_DOMAIN}/{primary}.md)"
        )
        if expert_assignment.secondary:
            secondary_links = ", ".join(
                f"[{discipline_titles[value]}]"
                f"(maps/{EXPERT_DOMAIN}/{value}.md)"
                for value in expert_assignment.secondary
            )
            nav.append(f"**Secondary:** {secondary_links}")
    nav += [
        "**Table:** [skills.base](skills.base)",
        "**Index:** [Skills Index](index.md)",
    ]
    lines += ["  ·  ".join(nav), ""]

    if expert_assignment is not None:
        lines += ["## Relevant capability domains", ""]
        bridges = set(expert_assignment.bridge_domains)
        lines += [
            f"- [{category_titles[domain]}](maps/{domain}.md)"
            for domain in bridge_domain_order
            if domain in bridges
        ]
    else:
        lines += ["## Related skills", ""]
        rel = sorted(related)
        if rel:
            lines += [
                f"- [{other}]({other}.md) — {short_descriptions[other]}"
                for other in rel
            ]
        else:
            lines.append(
                "_None auto-detected. Add your own links here, e.g. "
                "`[scanpy](scanpy.md)`._"
            )
    lines.append("")
    if personal:
        lines.append(personal)
    else:
        lines += [PERSONAL_MARKER, "", "## Notes", "", ""]
    return "\n".join(lines)


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
    title_by_key = {k: t for k, t, _, _, _ in CATEGORIES}
    key_by_skill, assigned = {}, {}
    for key, title, scope, related, skills in CATEGORIES:
        for s in skills:
            if s in assigned:
                print(f"WARNING: {s} in both {assigned[s]} and {key}", file=sys.stderr)
            assigned[s] = key
            key_by_skill[s] = key

    try:
        on_disk = discover_skills()
    except OSError as exc:
        print(f"ERROR: cannot discover skills in {VAULT_DIR}: {exc}", file=sys.stderr)
        return 1
    imported_profiles = {
        skill
        for skill in on_disk
        if skill != DISPATCHER and is_scientific_agents_profile(skill)
    }
    valid_bridge_domains = tuple(
        key for key, *_ in CATEGORIES if key != EXPERT_DOMAIN
    )
    try:
        catalog_profiles = load_catalog_profiles(CATALOG_PATH)
        taxonomy: ExpertTaxonomy = load_taxonomy(
            TAXONOMY_PATH,
            catalog_profiles=catalog_profiles,
            discovered_profiles=imported_profiles,
            valid_bridge_domains=valid_bridge_domains,
        )
    except TaxonomyValidationError as exc:
        print(exc, file=sys.stderr)
        return 1

    try:
        discipline_paths = {
            discipline.id: expert_map_path(EXPERT_MAPS_DIR, discipline.id)
            for discipline in taxonomy.disciplines
        }
    except TaxonomyValidationError as exc:
        print(exc, file=sys.stderr)
        return 1

    os.makedirs(MAPS_DIR, exist_ok=True)
    os.makedirs(EXPERT_MAPS_DIR, exist_ok=True)
    discipline_ids = tuple(
        discipline.id for discipline in taxonomy.disciplines
    )
    if GRAPH:
        update_graph()

    expert_skills = set(imported_profiles)
    if DISPATCHER in on_disk:
        expert_skills.add(DISPATCHER)
    for skill in expert_skills:
        assigned[skill] = EXPERT_DOMAIN
        key_by_skill[skill] = EXPERT_DOMAIN
    unsorted = sorted(on_disk - set(assigned))
    if unsorted:
        print(f"WARNING: not categorized: {unsorted}", file=sys.stderr)
    for s in unsorted:
        key_by_skill[s] = "uncategorized"

    skills_by_key = {key: [] for key, *_ in CATEGORIES}
    for s in on_disk:
        skills_by_key.setdefault(key_by_skill.get(s, "uncategorized"), []).append(s)

    skills_sorted = sorted(on_disk)
    full_desc = {s: read_description(s) for s in skills_sorted}
    short = {s: one_liner(full_desc[s]) for s in skills_sorted}
    related = build_related_excluding(skills_sorted, full_desc, expert_skills)
    discipline_titles = {
        discipline.id: discipline.title for discipline in taxonomy.disciplines
    }

    # ---- wrapper notes -----------------------------------------------------
    for s in skills_sorted:
        key = key_by_skill.get(s, "uncategorized")
        dtitle = title_by_key.get(key, "Uncategorized")
        ex = parse_existing(s)
        rendered = render_wrapper(
            s,
            key=key,
            domain_title=dtitle,
            description=full_desc[s],
            short_descriptions=short,
            related=related.get(s, set()),
            existing=ex,
            today=TODAY,
            force_aliases=FORCE_ALIASES,
            expert_assignment=taxonomy.profiles.get(s),
            discipline_titles=discipline_titles,
            category_titles=title_by_key,
            bridge_domain_order=valid_bridge_domains,
        )
        with open(os.path.join(ROOT, s + ".md"), "w", encoding="utf-8") as f:
            f.write(rendered)

    # ---- map notes ---------------------------------------------------------
    for key, title, scope, related_keys, skills in CATEGORIES:
        path = os.path.join(MAPS_DIR, f"{key}.md")
        created = existing_created(path)
        if key == EXPERT_DOMAIN:
            expert_outputs = [
                (
                    Path(path),
                    render_expert_master_map(
                        taxonomy=taxonomy,
                        title=title,
                        scope=scope,
                        created=created,
                    ),
                )
            ]
            for discipline in taxonomy.disciplines:
                discipline_path = discipline_paths[discipline.id]
                discipline_created = existing_created(discipline_path)
                expert_outputs.append(
                    (
                        discipline_path,
                        render_expert_discipline_map(
                            discipline=discipline,
                            taxonomy=taxonomy,
                            short_descriptions=short,
                            category_titles=title_by_key,
                            bridge_domain_order=valid_bridge_domains,
                            created=discipline_created,
                        ),
                    )
                )
            for output_path, rendered in expert_outputs:
                atomic_write_text(output_path, rendered)
            if discipline_ids:
                prune_stale_expert_maps(EXPERT_MAPS_DIR, discipline_ids)
            continue
        live = sorted(skills_by_key.get(key, []))
        L = ["---", f"title: {title}", "tags:", "  - skill-map", f"created: {created}", "---", "",
             f"# {title}", "", "> [!abstract] Scope", f"> {scope}", "",
             "[Back to Skill Index](../index.md)", ""]
        rel = [f"[{title_by_key[r]}]({r}.md)" for r in related_keys if r in title_by_key]
        if rel:
            L += ["**Related maps:** " + " | ".join(rel), ""]
        L += [f"## Skills ({len(live)})", ""]
        L += [f"- [{s}](../{s}.md) — {short[s]}" for s in live]
        L.append("")
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(L))

    # ---- index -------------------------------------------------------------
    total = len(on_disk)
    index_path = os.path.join(ROOT, "index.md")
    index_created = existing_created(index_path)
    I = ["---", "title: Skills Index", "tags:", "  - moc", "  - skill-index",
         f"created: {index_created}", "---", "", "# Skills Index", "",
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
        live = sorted(skills_by_key.get(key, []))
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
    with open(index_path, "w", encoding="utf-8") as f:
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
