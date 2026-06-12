---
name: linear
description: Linear project management — create and manage issues, projects, cycles, and roadmaps via the Linear API, MCP server, or web browser. Use when creating issues/bugs, triaging backlogs, querying project status, managing sprints/cycles, linking GitHub PRs to issues, automating issue workflows, or integrating Linear into development pipelines. Works via Linear MCP server (preferred), REST API, or agent-browser automation.
---

# Linear — Project Management for Dev Teams

Linear is a fast issue tracker and project management tool built for software teams. Issues, projects, cycles (sprints), and roadmaps are its core constructs.

## Access Methods

Three ways to interact with Linear:

1. **Linear MCP server** (preferred — structured, API-backed)
2. **Linear REST/GraphQL API** (for scripts and integrations)
3. **agent-browser** (for UI tasks not covered by the API)

---

## Linear MCP Server

If the Linear MCP server is configured, use its tools directly:

```
# Common MCP operations (tool names vary by MCP config):
linear_create_issue      - Create a new issue
linear_list_issues       - Query/filter issues
linear_update_issue      - Update state, assignee, priority, labels
linear_get_issue         - Get issue details by ID
linear_search_issues     - Full-text search
linear_list_projects     - List projects and their status
linear_list_teams        - List workspace teams
```

Linear hosts the MCP server remotely at `https://mcp.linear.app/mcp` (Streamable HTTP, OAuth 2.1 — no API key needed). Connect directly where HTTP transport is supported:

```bash
# Claude Code
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
# then run /mcp in a session to complete the OAuth flow
```

For clients that only support stdio MCP servers, bridge with `mcp-remote`:
```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"]
    }
  }
}
```

---

## Linear API (GraphQL)

Linear uses GraphQL. Base URL: `https://api.linear.app/graphql`

### Authentication

```bash
# Personal API key (for scripts/agents)
export LINEAR_API_KEY="lin_api_..."

curl -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ viewer { id name email } }"}'
```

### Common Queries

```graphql
# Get current user and teams
{
  viewer {
    id name email
    teams { nodes { id name key } }
  }
}

# List issues for a team
query TeamIssues($teamId: String!) {
  team(id: $teamId) {
    issues(first: 50, filter: { state: { type: { in: [started, unstarted] } } }) {
      nodes {
        id identifier title priority state { name color }
        assignee { name } labels { nodes { name } }
      }
    }
  }
}

# Search issues
{
  issueSearch(query: "authentication bug", first: 20) {
    nodes { id identifier title state { name } priority }
  }
}
```

### Common Mutations

```graphql
# Create an issue
mutation CreateIssue($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier title url }
  }
}
# Variables: { "input": { "teamId": "...", "title": "Fix auth bug", "priority": 2 } }

# Update issue state
mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue { id state { name } }
  }
}
# Variables: { "id": "ISSUE-ID", "input": { "stateId": "STATE-ID" } }
```

### Priority Values

| Priority | Value |
|----------|-------|
| No priority | 0 |
| Urgent | 1 |
| High | 2 |
| Medium | 3 |
| Low | 4 |

---

## Python SDK

```python
pip install linear-python
```

The package is imported from `linear_python` and the API key is passed positionally.
Methods take/return plain dicts (it's a thin wrapper over the GraphQL API), and `create_issue`
only accepts `teamId`, `title`, and `description` — for richer fields (priority, labels,
assignee) call the GraphQL API directly (see above).

```python
from linear_python import LinearClient

client = LinearClient("lin_api_...")

# Current user
viewer = client.get_viewer()        # -> {"id", "name", "email"}

# Teams
teams = client.get_teams()          # -> {"nodes": [{"id", "name"}, ...]}

# Create issue — data is a dict; teamId + title are required
result = client.create_issue({
    "teamId": "TEAM-ID",
    "title": "Fix authentication bug",
    "description": "Users can't log in with OAuth. See error logs.",
})
issue = result["issue"]             # {"id", "title", "url"}
print(f"Created: {issue['url']}")

# Get / update / delete
client.get_issue("ISSUE-ID")
client.update_issue("ISSUE-ID", {"title": "Updated title"})
# delete_issue accepts a permanently_delete kwarg, but linear-python 0.2.2 does
# not actually forward it to the API (no-op), so it's omitted here
client.delete_issue("ISSUE-ID")
```

---

## Browser Automation

For tasks not covered by the API (bulk drag/drop, visual project views):

```bash
# Open Linear
agent-browser open https://linear.app

# Take a snapshot to see current state
agent-browser snapshot -i

# Navigate and interact
agent-browser click @e12    # click an element by ref
agent-browser type @e15 "Fix auth"   # type into a field
```

See [[agent-browser]] for the full snapshot-interact workflow.

---

## GitHub Integration

Link PRs to Linear issues automatically:
- Include issue ID in commit messages or branch names: `fix/AUTH-123-login-bug`
- Linear auto-detects and links the PR
- PR merge can auto-close the issue (configure in Linear → Settings → Integrations → GitHub)

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Issue** | A task, bug, or feature (has ID like `ENG-123`) |
| **Project** | A milestone or feature grouping issues |
| **Cycle** | Time-boxed sprint (1–4 weeks typical) |
| **Team** | A group working on a set of projects |
| **State** | Issue status: Backlog → In Progress → Done (customizable) |
| **Priority** | Urgent/High/Medium/Low/No Priority |
| **Roadmap** | High-level view across projects and quarters |

---

## Common Workflows

### Triage a backlog
```graphql
{
  team(id: "TEAM-ID") {
    issues(filter: { state: { type: { eq: backlog } }, priority: { lte: 2 } }) {
      nodes { id identifier title priority createdAt assignee { name } }
    }
  }
}
```

### Find issues without an assignee
```graphql
{
  team(id: "TEAM-ID") {
    issues(filter: { assignee: { null: true }, state: { type: { in: [started] } } }) {
      nodes { id identifier title }
    }
  }
}
```

### Get current cycle issues
```graphql
{
  team(id: "TEAM-ID") {
    activeCycle {
      id name startsAt endsAt progress
      issues { nodes { id identifier title state { name } assignee { name } } }
    }
  }
}
```

---

## Related Skills

- [[gh-cli]] — GitHub PRs and issues (complement to Linear for code-side tracking)
- [[agent-browser]] — Browser automation for visual/UI tasks in Linear
- [[github-actions-ci]] — CI/CD workflows that can update Linear issues on deploy
