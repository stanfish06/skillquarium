---
name: plugin-creator
description: Scaffold a complete cave plugin bundle — generates .cave-plugin/plugin.json manifest and the standard directory structure (commands/, skills/, agents/, themes/, hooks/). Use when a user wants to create, publish, or package a cave plugin for the marketplace. Triggered by "create a plugin", "scaffold a plugin", "/plugin create", or "new cave plugin".
allowed-tools:
  - read
  - write
  - edit
  - bash
effort: low
---

# Plugin Creator

You scaffold new cave plugins. A cave plugin is a directory published to GitHub (or any zip URL) with a `.cave-plugin/plugin.json` manifest and optional sub-directories for commands, skills, agents, themes, and hooks.

## Manifest Schema

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "A short, clear description of what this plugin does.",
  "author": "your-github-handle",
  "license": "MIT",
  "homepage": "https://github.com/your-handle/my-plugin",
  "caveVersion": ">=0.65.0",
  "tags": ["productivity", "git"],
  "capabilities": {
    "commands": true,
    "skills": true,
    "agents": false,
    "themes": false,
    "mcp": false,
    "hooks": []
  }
}
```

### Field Rules

- `name`: kebab-case, a-z0-9 and hyphens only. Must be unique in the marketplace.
- `version`: semver ("major.minor.patch").
- `description`: one sentence, plain text.
- `tags`: free-form strings for `caveman plugin search` matching.
- `capabilities.commands`: set `true` if `commands/` directory is present.
- `capabilities.skills`: set `true` if `skills/` directory is present.
- `capabilities.agents`: set `true` if `agents/` directory is present.
- `capabilities.themes`: set `true` if `themes/` directory is present.
- `capabilities.mcp`: set `true` if `.mcp.json` is present.
- `capabilities.hooks`: array of hook entries (see below).

### Hook Entry Shape

```json
{ "event": "PostToolUse", "command": "hooks/post-tool-use.sh", "matcher": "Bash" }
```

## Directory Structure

```
my-plugin/
├── .cave-plugin/
│   └── plugin.json          ← required
├── commands/
│   └── my-command.md        ← markdown slash commands
├── skills/
│   └── my-skill/
│       └── SKILL.md         ← skill with frontmatter
├── agents/
│   └── my-agent.md          ← agent definition markdown
├── themes/
│   └── my-theme.json        ← theme JSON (cave theme format)
├── hooks/
│   └── post-tool-use.sh     ← hook scripts (chmod +x)
├── .mcp.json                ← optional MCP server definitions
└── README.md
```

## Scaffolding Steps

When the user asks to create a plugin, follow these steps:

1. **Ask for plugin details** (name, description, which capabilities are needed).
2. **Create `.cave-plugin/plugin.json`** using the schema above.
3. **Create only the sub-directories that are needed** (do not create empty dirs).
4. **Add placeholder files** for each enabled capability:
   - `commands/example.md` with frontmatter `---\ndescription: Example command.\n---\n\n# Example\n\nDescribe what this command does.\n`
   - `skills/example/SKILL.md` with the standard skill frontmatter.
   - `agents/example.md` with agent frontmatter.
   - `hooks/example.sh` with `#!/bin/bash\n# Hook: <event>\n` and `chmod +x`.
5. **Create a `README.md`** with install instructions and a short description.
6. **Validate the manifest** by echoing it back and checking all required fields.

## Publishing

After scaffolding, instruct the user to:

1. Push the plugin to a public GitHub repository.
2. Submit it to a marketplace by adding an entry to a `marketplace.json`:
   ```json
   {
     "plugins": [
       {
         "ref": "your-handle/my-plugin",
         "name": "my-plugin",
         "description": "...",
         "tags": ["..."],
         "version": "0.1.0"
       }
     ]
   }
   ```
3. Users install it with: `caveman plugin install your-handle/my-plugin`

## Example Interaction

User: "Create a plugin that adds a /summarize command and a post-save hook."

You:
1. Create `.cave-plugin/plugin.json` with `"commands": true, "hooks": [{ "event": "PostToolUse", "command": "hooks/post-save.sh", "matcher": "Write" }]`.
2. Create `commands/summarize.md` with a summarize slash command description.
3. Create `hooks/post-save.sh` with a stub hook script.
4. Create `README.md`.
5. Report the file tree created.
