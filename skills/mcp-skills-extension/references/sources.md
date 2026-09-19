# Sources and drift checks

This skill is authored in Skillquarium from the official extension specification.
Its source repository is a documentation project, so it is tracked through skill
metadata rather than an upstream skill-folder entry in `.skill-lock.json`.

## Reviewed baseline

- GitHub source: <https://github.com/modelcontextprotocol/ext-skills>
- Reviewed commit: `0e85d4db8860a305c857f26fdede64f416675b92`
- Checked on: 2026-09-18
- Normative source path: `specification/stable/skills.mdx`
- [Pinned specification](https://github.com/modelcontextprotocol/ext-skills/blob/0e85d4db8860a305c857f26fdede64f416675b92/specification/stable/skills.mdx)
- Base protocol revision used by that specification: `2026-07-28`

## Live references

- [Stable specification](https://github.com/modelcontextprotocol/ext-skills/blob/main/specification/stable/skills.mdx): protocol requirements and message shapes.
- [Decision log](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/decisions.md): accepted changes and pending proposals; check each entry's status.
- [Official overview](https://modelcontextprotocol.io/extensions/skills/overview): explanatory flow and examples.
- [Client matrix](https://modelcontextprotocol.io/extensions/client-matrix) and [implementation tracker](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/implementations.md): compatibility leads; verify against the actual product release before relying on support.
- [Agent Skills specification](https://agentskills.io/specification): directory layout, frontmatter, and naming rules delegated by this extension.
- [MCP conformance tooling](https://github.com/modelcontextprotocol/conformance): check current scenarios and supported revisions when testing an implementation.

The stable specification is authoritative for this skill. Archived working-group
documents describe earlier designs; SDK demos and open PRs can also target a
different revision. Do not promote their behavior into a current requirement.

## Refresh procedure

1. Read `source-repo`, `source-commit`, and `source-path` in `SKILL.md`. The vault's
   existing `skillquarium drift` scanner reads the first two fields and compares
   the pinned commit with repository HEAD. This also flags unrelated commits;
   it does not determine whether the specification changed.
2. Compare the recorded commit with current `main`, focusing on the normative
   source, accepted decisions, and any new released specification. GitHub provides
   a [comparison from this baseline](https://github.com/modelcontextprotocol/ext-skills/compare/0e85d4db8860a305c857f26fdede64f416675b92...main).
   With authenticated `gh`, inspect current HEAD using:

   ```bash
   gh api repos/modelcontextprotocol/ext-skills/commits/main --jq '.sha'
   ```

3. If `source-path` moved, follow the repository README to the current normative
   document. Check negotiation, method/result shapes, manifest verification,
   origin/approval/cache rules, and base protocol compatibility before revising
   implementation advice. Verify SDK/client status separately; it can change
   without a specification edit.
4. Update the guide and relevant host instructions, then advance `source-commit`,
   `source-path`, `source-checked`, and `protocol-revision` as appropriate. Keep the
   baseline and pinned links in both reference files consistent with the metadata.
   Record a new checked date even when review finds no relevant changes.
5. Validate the skill and refresh the vault navigation, graph, and embeddings.
   The pin records reviewed evidence; it is not an instruction to freeze projects
   on an old SDK or protocol revision.
