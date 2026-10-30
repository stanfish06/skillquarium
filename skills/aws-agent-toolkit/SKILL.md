---
name: aws-agent-toolkit
description: Pull AWS's official agent skills (Agent Toolkit for AWS, ~115 skills) from the remote catalog on demand with the `aws agent-toolkit` CLI instead of keeping them installed. Use for any task on a specific AWS service — DynamoDB, Aurora/RDS, Lambda, Step Functions, API Gateway, CDK, CloudFormation, IAM, VPC/Route 53/CloudFront/WAF, S3, EFS, CloudWatch, Glue/Athena/MWAA/MSK/Redshift, Bedrock, Braket, Amplify — or when the user mentions `aws configure agent-toolkit`, the AWS MCP Server, or wants AWS skills installed.
---

# aws-agent-toolkit

AWS publishes its agent skills ([aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws))
through a catalog the AWS CLI can query. This vault does not copy them. Search the catalog, read the
matching skill's `SKILL.md`, and follow it.

Needs AWS CLI `2.35.9`+ (including the wizard's `--yes` option). Catalog commands need no credentials.
The Agent Toolkit catalog is available only in `us-east-1`, so always pass `--region us-east-1`, even
when the user's default AWS region differs. The skill's own instructions may still need credentials
to call AWS in the workload's region.

## Find and read a skill

```bash
aws agent-toolkit search-skills --search-query "dynamodb single table" --region us-east-1
aws agent-toolkit list-available-skills --region us-east-1                       # full catalog
aws agent-toolkit list-available-skills --category-filter aws-core --region us-east-1   # 24 router skills
aws agent-toolkit get-skill-metadata --skill-name amazon-dynamodb --region us-east-1     # version + file list
aws agent-toolkit get-skill-file --skill-name amazon-dynamodb --file-path SKILL.md --region us-east-1
```

Start with an `aws-core` skill (`aws-serverless`, `aws-database`, `aws-networking`, ...) when the service
is not settled yet; those route to the specialized ones. Fetch `references/*.md` with the same
`get-skill-file` call when the `SKILL.md` points to them. Pin with `--skill-version v1` when the result
must be reproducible.

## When reading is not enough

If `get-skill-metadata` lists `scripts/`, the scripts expect the skill to sit in an agent's skills
directory (some resolve their own root by searching `~/.claude`, `~/.codex`, `~/.kiro`, ...). Install
that one skill for the current agent, after telling the user:

```bash
aws agent-toolkit add-skill --skill-name amazon-dynamodb --agent claude-code --region us-east-1
aws agent-toolkit list-installed-skills --region us-east-1
aws agent-toolkit remove-skill --skill-name amazon-dynamodb --agent claude-code --region us-east-1
```

`--agent` values: `claude-code`, `codex`, `cursor`, `gemini-cli`, `kiro`, `opencode`, `pi`, `cline`,
`openclaw`, `windsurf`, `universal`. Without `--agent`, the command writes to every agent config
directory it detects.

## Full setup

`aws configure agent-toolkit --region us-east-1` is an interactive wizard that installs the default AWS skills into every
detected agent and configures the AWS MCP Server (API calls, sandboxed scripts, docs search). It writes to
agent config directories outside this vault, so the user runs it, not the agent. `--yes` accepts every
default without prompting. For the MCP Server alone, see `aws-mcp-setup`.

For a named profile, add `--profile <profile-name>` to the wizard command. After setup, check each
generated `aws-mcp` server entry: it defaults to the `default` profile. Set `AWS_MCP_PROXY_PROFILES`
to `<profile-name>` in that entry's environment using the agent's configuration format (JSON for
many agents; TOML for Codex). Keep the generated command, arguments, timeout, and transport settings,
and restart each configured agent to load the change. Multiple profile names are space-separated.
