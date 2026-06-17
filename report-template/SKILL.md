---
name: report-template
description: Publication-quality PDF report generation using Typst templates. Produces professional scientific reports with colored section bands, styled tables, figure captions, callout boxes, and page headers/footers.
---

# Report Template System

Generate publication-quality PDF reports using the BioClaw Typst template engine.

## Quick Start

```python
import sys
# Add this skill's directory (the folder containing report_builder.py) to sys.path,
# e.g. ~/.agents/skills/report-template in this vault.
sys.path.insert(0, "path/to/report-template")
from report_builder import ReportBuilder, T

report = ReportBuilder(
    title="My Analysis Report",
    subtitle="Project XYZ",
    author="BioClaw",
)

# Add a section: a heading followed by body text
report.heading(1, "Background")
report.text("Description of the project...")

# Add a table under its own heading
report.heading(1, "Results")
report.table(
    ["Sample", "Value", "Status"],
    [["A", "92.3", "Pass"], ["B", "87.1", "Pass"]],
    caption="Summary of results",
)

# Compile to PDF
report.compile("output/report.pdf")
```

## Available Components

Call methods on the `ReportBuilder` instance to append content in order. The `T`
namespace exposes the same helpers as static functions that return raw Typst
markup — combine them with `report.raw(...)`.

### Headings & Text
```python
report.heading(level, "Section title")   # level 1, 2, ...
report.text("Plain paragraph")
report.raw(T.bold("Bold") + " / " + T.italic("italic"))
report.raw(T.list(["Item 1", "Item 2"]))
report.raw(T.enum(["Step 1", "Step 2"]))
```

### Tables
```python
report.table(headers, rows, caption=None)
```

### Callout Boxes
```python
report.callout(text, title="Note", kind="note")
# kind: "note" (blue), "warning" (yellow), "success" (green), "danger" (red)
```

### Figures
```python
report.set_image_dir("path/to/figures")          # directory holding referenced images
report.image(path, caption=None, width="100%")   # path is relative to the image dir
```

### Metadata Blocks
```python
report.metadata_block([("Key", "Value"), ("Date", "2026-04-15")])
```

### Metric Cards
```python
report.metric_cards([
    {"label": "Samples", "value": "6"},
    {"label": "Quality", "value": "A+"},
])
```

### Layout
```python
report.pagebreak()
report.vspace("12pt")
```

## Template Features

- Dark navy section heading bands with white text
- Teal sub-heading accents
- Professional page headers and footers with page numbers
- Alternating-row table styling
- Four callout box types (note, warning, success, danger)
- Figure numbering and italic captions
- Key-value metadata blocks
- Metric card rows

## Requirements

- Python package: `typst` (`pip install typst`)
- No system dependencies required
