#!/usr/bin/env python3
"""Build the human-navigation layer for the skills vault.

Generates, for every skill folder that contains a SKILL.md:
  - <skill>.md            a root-level wrapper note (safe to hand-edit; the
                          "Personal notes" section is preserved on re-run)
  - maps/<domain>.md      one map (MOC) note per domain, linking to wrappers
  - index.md              master index linking to maps + every wrapper (A-Z)

The original <skill>/SKILL.md files are never touched, so an external skills
CLI can keep managing them remotely. Re-run this script after adding/removing
skills; your personal notes in each wrapper are kept.

Usage:  python3 .skill-vault/build.py
"""
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS_DIR = os.path.join(ROOT, "maps")
TODAY = date.today().isoformat()
PERSONAL_MARKER = "%% ---8<--- personal notes below are preserved on re-run ---8<--- %%"

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
      "geniml", "gtars", "polars-bio", "nfcore-sarek-wrapper", "pacsomatic", "marker-dominance-mapper"]),

    ("single-cell-rnaseq", "Single-Cell, RNA-seq & Functional Genomics",
     "scRNA-seq and bulk RNA-seq pipelines, differential expression, and pathway/network analysis.",
     ["genomics-variants", "proteomics-metabolomics", "sequence-phylogenetics", "bio-databases-platforms"],
     ["scanpy", "anndata", "scvi-tools", "scvelo", "cellxgene-census", "scrna-embedding",
      "scrna-orchestrator", "nfcore-scrnaseq-wrapper", "bulk-rnaseq", "rnaseq-de", "pydeseq2",
      "nfcore-rnaseq-wrapper", "rare-disease-rnaseq", "de-summary", "diff-visualizer", "arboreto",
      "deeptools", "pathway-enricher", "pathway-enrichment"]),

    ("proteomics-metabolomics", "Proteomics & Metabolomics",
     "Mass-spec and affinity proteomics, metabolomics spectral analysis, and glycoengineering.",
     ["single-cell-rnaseq", "drug-discovery-chem", "sequence-phylogenetics"],
     ["proteomics-de", "proteomics-clock", "affinity-proteomics", "pyopenms", "matchms", "glycoengineering"]),

    ("drug-discovery-chem", "Drug Discovery, Cheminformatics & Structural Biology",
     "Small-molecule and protein modeling: cheminformatics, docking, structure prediction, and target validation.",
     ["proteomics-metabolomics", "sequence-phylogenetics", "bio-databases-platforms", "ml-ai"],
     ["rdkit", "datamol", "deepchem", "molfeat", "medchem", "pytdc", "torchdrug", "diffdock",
      "struct-predictor", "esm", "molecular-dynamics", "cobrapy", "rowan", "adaptyv",
      "target-validation-scorer", "drug-repurposing-screen", "depmap", "crispr-screen-triage",
      "omics-target-evidence-mapper"]),

    ("sequence-phylogenetics", "Sequence Analysis, NGS & Phylogenetics",
     "Sequence toolkits, read QC/alignment, phylogenetic inference, and sequence-to-function models.",
     ["genomics-variants", "single-cell-rnaseq", "bio-databases-platforms"],
     ["biopython", "bioservices", "gget", "scikit-bio", "phylogenetics", "phylogenetics-builder",
      "etetoolkit", "busco-assessor", "analyze-fasta", "seq-wrangler", "multiqc-reporter",
      "bioqc-mcp", "claw-metagenomics", "ncbi-datasets", "bioconductor-bridge",
      "gi-annotation", "gi-chromatin", "gi-enhancer", "gi-expression", "gi-promoter", "gi-splice"]),

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
      "neurokit2", "bids", "imaging-data-commons"]),

    ("ml-ai", "Machine Learning & AI",
     "General ML/DL frameworks, model interpretability, RL, graph learning, and scientific model hubs.",
     ["data-science-compute", "drug-discovery-chem", "cloud-devops"],
     ["scikit-learn", "pytorch-lightning", "transformers", "shap", "stable-baselines3", "pufferlib",
      "torch-geometric", "umap-learn", "aeon", "timesfm-forecasting", "hugging-science"]),

    ("data-science-compute", "Data Science, Stats & Scientific Computing",
     "DataFrames, big-data tooling, statistics, optimization, simulation, geospatial, and plotting.",
     ["ml-ai", "quantum-physics", "research-writing"],
     ["polars", "dask", "vaex", "zarr-python", "networkx", "sympy", "matlab", "statsmodels",
      "statistical-analysis", "scikit-survival", "pymc", "pymoo", "simpy", "geomaster", "geopandas",
      "exploratory-data-analysis", "optimize-for-gpu", "usfiscaldata", "matplotlib", "seaborn"]),

    ("quantum-physics", "Quantum, Physics & Materials",
     "Quantum computing frameworks, open quantum systems, astronomy, fluid dynamics, and materials science.",
     ["data-science-compute", "ml-ai"],
     ["qiskit", "cirq", "pennylane", "qutip", "astropy", "fluidsim", "pymatgen"]),

    ("research-writing", "Scientific Writing, Figures & Publishing",
     "Manuscript writing, figures and schematics, posters/slides, reference management, and pre-submission review.",
     ["academic-pipelines", "literature-discovery", "documents-office", "reasoning-ideation"],
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
      "market-research-reports"]),

    ("cloud-devops", "Cloud, Infra & MLOps",
     "AWS architecture and operations, serverless GPU compute, the Hugging Face CLI, and Nextflow pipelines.",
     ["ml-ai", "bio-databases-platforms", "vault-meta"],
     ["aws-agentic-ai", "aws-cdk-development", "aws-cost-operations", "aws-mcp-setup",
      "aws-serverless-eda", "modal", "hf-cli", "nextflow"]),

    ("vault-meta", "Vault, Skills & Workflow Meta",
     "Obsidian authoring, skill building/discovery, reproducibility, orchestration, and resource detection.",
     ["cloud-devops", "reasoning-ideation"],
     ["obsidian-markdown", "obsidian-bases", "obsidian-cli", "json-canvas", "skill-builder",
      "find-skills", "autoskill", "clawpathy-autoresearch", "repro-enforcer", "bio-orchestrator",
      "get-available-resources"]),

    ("reasoning-ideation", "Reasoning, Ideation & Decision",
     "Multi-perspective deliberation, brainstorming, hypothesis generation, idea evaluation, and scenario analysis.",
     ["research-writing", "academic-pipelines", "vault-meta"],
     ["consciousness-council", "what-if-oracle", "dhdna-profiler", "scientific-brainstorming",
      "hypothesis-generation", "idea-evaluator", "vibe-research-workflow", "hypogenic"]),
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
    desc = " ".join(desc.split())
    return desc or None


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


def discover_skills():
    found = set()
    for name in os.listdir(ROOT):
        if name.startswith("."):
            continue
        p = os.path.join(ROOT, name)
        if os.path.isdir(p) and os.path.isfile(os.path.join(p, "SKILL.md")):
            found.add(name)
    return found


def build_related(skills, full_desc):
    """Undirected related-graph mined from cross-references in descriptions."""
    patterns = {s: re.compile(r"(?<![\w-])" + re.escape(s) + r"(?![\w-])", re.IGNORECASE)
                for s in skills}
    edges = {s: set() for s in skills}
    for s in skills:
        d = full_desc.get(s) or ""
        if not d:
            continue
        for t in skills:
            if t == s:
                continue
            if patterns[t].search(d):
                edges[s].add(t)
                edges[t].add(s)  # symmetrize
    return edges


def preserved_notes(skill):
    """Return the personal-notes block from an existing wrapper, if any."""
    path = os.path.join(ROOT, skill + ".md")
    if not os.path.isfile(path):
        return None, None
    txt = open(path, encoding="utf-8").read()
    created = None
    cm = re.search(r"^created:\s*(.+)$", txt, re.MULTILINE)
    if cm:
        created = cm.group(1).strip()
    idx = txt.find(PERSONAL_MARKER)
    if idx == -1:
        return None, created
    return txt[idx:], created


def main():
    os.makedirs(MAPS_DIR, exist_ok=True)
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
        notes_block, created = preserved_notes(s)
        created = created or TODAY
        L = []
        L.append("---")
        L.append(f"title: {s}")
        L.append("tags:")
        L.append("  - skill")
        if key != "uncategorized":
            L.append(f"  - domain/{key}")
        L.append(f"source: {s}/SKILL.md")
        L.append(f"created: {created}")
        L.append("---")
        L.append("")
        L.append(f"# {s}")
        L.append("")
        L.append("> [!info] What it does")
        L.append(f"> {full_desc[s] or '(no description)'}")
        L.append("")
        nav = [f"**Source:** [{s}/SKILL.md]({s}/SKILL.md)"]
        if key != "uncategorized":
            nav.append(f"**Domain:** [{dtitle}](maps/{key}.md)")
        nav.append("**Index:** [Skills Index](index.md)")
        L.append("  ·  ".join(nav))
        L.append("")
        rel = sorted(related.get(s, []))
        L.append("## Related skills")
        L.append("")
        if rel:
            for r in rel:
                L.append(f"- [{r}]({r}.md) — {short[r]}")
        else:
            L.append("_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._")
        L.append("")
        if notes_block:
            L.append(notes_block.rstrip() + "\n")
        else:
            L.append(PERSONAL_MARKER)
            L.append("")
            L.append("## Notes")
            L.append("")
            L.append("")
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
            L.append("**Related maps:** " + " | ".join(rel))
            L.append("")
        L.append(f"## Skills ({len(live)})")
        L.append("")
        for s in live:
            L.append(f"- [{s}](../{s}.md) — {short[s]}")
        L.append("")
        with open(os.path.join(MAPS_DIR, f"{key}.md"), "w", encoding="utf-8") as f:
            f.write("\n".join(L))

    # ---- index -------------------------------------------------------------
    total = len(on_disk)
    I = ["---", "title: Skills Index", "tags:", "  - moc", "  - skill-index",
         f"created: {TODAY}", "---", "", "# Skills Index", "",
         f"A navigable map of the **{total} agent skills** in this vault, grouped into "
         f"{len(CATEGORIES)} domains. Each entry links to a per-skill note that wraps the "
         f"original `SKILL.md` and holds your personal notes.", "",
         "> [!tip] How to navigate",
         "> - Browse a **domain map** below for grouped, cross-linked skills.",
         "> - Jump to any skill via the **A–Z list** at the bottom.",
         "> - Each skill note links to its source `SKILL.md` and to related skills.",
         "> - Open Obsidian **Graph view** to see index, maps, and skills connect.", "",
         "## Browse by domain", ""]
    for key, title, scope, related_keys, skills in CATEGORIES:
        live = sorted(s for s in skills if s in on_disk)
        I.append(f"### [{title}](maps/{key}.md)  ·  {len(live)} skills")
        I.append("")
        I.append(scope)
        I.append("")
        preview = live[:6]
        chips = ", ".join(f"[{s}]({s}.md)" for s in preview)
        more = f" … [see all {len(live)} →](maps/{key}.md)" if len(live) > len(preview) else ""
        I.append(chips + more)
        I.append("")
    I.append("## All skills (A–Z)")
    I.append("")
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
        I.append("## Uncategorized"); I.append("")
        for s in unsorted:
            I.append(f"- [{s}]({s}.md) — {short[s]}")
        I.append("")
    with open(os.path.join(ROOT, "index.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(I))

    edge_count = sum(len(v) for v in related.values()) // 2
    print(f"OK: {total} wrappers, {len(CATEGORIES)} maps, {edge_count} related-links, "
          f"unsorted={len(unsorted)}")


if __name__ == "__main__":
    main()
