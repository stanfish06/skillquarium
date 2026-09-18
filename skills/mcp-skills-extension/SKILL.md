---
name: mcp-skills-extension
description: Implement and troubleshoot the MCP Skills extension (io.modelcontextprotocol/skills). Use when serving Agent Skills from an MCP server, adding skill discovery and verified loading to a host, or debugging skills/list, skills/get, and skill resource retrieval.
metadata:
  source-repo: modelcontextprotocol/ext-skills
  source-url: https://github.com/modelcontextprotocol/ext-skills
  source-commit: 0e85d4db8860a305c857f26fdede64f416675b92
  source-path: specification/stable/skills.mdx
  source-checked: "2026-09-18"
  protocol-revision: "2026-07-28"
---

# MCP Skills Extension

Publish existing Agent Skills through MCP and load them in compatible hosts. Tool
descriptions explain individual operations; a skill supplies a reusable procedure
that can coordinate several tools, with references or scripts loaded when needed.
The extension transports the existing `SKILL.md` format without redefining it.

This is a locally authored guide based on
[modelcontextprotocol/ext-skills](https://github.com/modelcontextprotocol/ext-skills).
The [stable specification](https://github.com/modelcontextprotocol/ext-skills/blob/main/specification/stable/skills.mdx)
defines the protocol. Read [sources and drift checks](references/sources.md) before
implementing against a newer revision or updating this skill. Its frontmatter pins
the reviewed source; a newer repository commit is a review signal, not proof of a
protocol change.

## Establish the integration target

Identify whether the task concerns a server publishing skills, a host loading
skills, or interoperability between them. Check the actual SDK version and target
client's extension support before choosing an API. Generic MCP resource support
does not establish Skills support; the upstream repository itself contains docs,
not an installable server or SDK.

The reviewed specification targets base protocol `2026-07-28` or later. Check its
capability negotiation, result envelopes, and required request `_meta` against the
selected SDK. Do not transplant examples into an older protocol implementation
without checking compatibility. Use `mcp-builder` when general MCP server setup is
also needed; keep this skill focused on the extension.

## Publish skills from a server

1. Start with valid Agent Skills directories. Each has a root `SKILL.md` with YAML
   `name` and `description`; its parent directory's final segment matches `name`.
   Preserve all frontmatter fields when producing the entry's `frontmatter` object.
2. Map every file to an individually readable resource. Prefer
   `skill://<prefix>/<name>/SKILL.md` for the entrypoint, with supporting files under
   the same directory. Other schemes are allowed. The URI authority is a namespace,
   not a hostname to resolve. Resolve relative references against the skill root.
3. Create a complete `resources` manifest containing every file exactly once,
   including `SKILL.md` and any nested skill files. Each entry has `uri`, `size` in
   raw bytes, and `digest` as `sha256:` plus 64 lowercase hexadecimal characters.
   Compute both from the exact bytes returned to clients, including line endings.
4. Declare `resources: {}` and `extensions: { "io.modelcontextprotocol/skills": {} }`
   in server capabilities exposed by `server/discover`. Implement the methods below.
   Every request still needs the base protocol's required `_meta`; abbreviated
   upstream examples omit it for readability.
5. Keep skill entries and served bytes consistent across updates. Clients reject
   reads that disagree with their held manifest. For content whose digests cannot
   be stable, explicitly use `resources: "dynamic"`; clients may decline it.

| Method | Implementation requirements |
| --- | --- |
| `skills/list` | Return skill entries under `skills`; support cursor pagination. Each entry contains a complete manifest, never one split across pages. |
| `skills/get` | Accept the `uri` of `SKILL.md`; return the same entry shape under `skill`. Support every served skill, including ones omitted from listings. |
| `resources/read` | Serve `SKILL.md` and supporting files by URI through the existing Resources primitive. |
| `resources/directory/read` | Optional. Advertise `directoryRead: true` only when implemented for every directory in the served skill namespaces. Return direct children, paginate them, use `inode/directory` for directories, and omit trailing slashes from directory URIs. |

List, get, and file-read results use `resultType: "complete"`, `ttlMs`, and
`cacheScope` under the reviewed base revision. Directory-read results use
`resultType: "complete"` and may include `nextCursor`; do not invent cache fields
by copying the other response shapes. Consult the source schemas for complete
messages rather than deriving SDK method names from JSON-RPC method names.

Return `-32602` for unknown skill/file URIs or invalid directory URIs, and `-32603`
for internal failures. Servers should keep each skill within 512 files and 16 MiB
total; conforming hosts must support skills up to those limits and may accept more.
The extension defines individual resource retrieval, with no bundled archive form.

## Load skills in a host

Read [host integration](references/host-integration.md) when implementing discovery,
activation, caching, execution permissions, or verification failures. These belong
in host code; instructions in `SKILL.md` cannot enforce them.

Discover metadata first and fetch content only when needed. A generic
`resources/read` of `SKILL.md` is ordinary resource content; activation happens
through the host's skill-loading path. Register skills by originating server plus
URI, then verify files and frontmatter before giving them effect. Reading a skill
does not automatically execute its scripts or grant its requested permissions.

## Verify the integration

Use a temporary two-file skill (`SKILL.md` and a referenced text file) and the
actual target client. Record the SDK/client versions, launch commands, fixture
bytes, and observed requests so the result can be reproduced. Cover the applicable
server or host behavior:

- List an entry, load its instructions, then read the referenced file. Check byte
  sizes and SHA-256 digests independently. Listing must not fetch file contents.
- Resolve a known skill URI through `skills/get` even when omitted from a listing;
  distinguish an empty listing from an unknown URI.
- Exercise pagination without splitting a skill manifest. Call directory read
  only when advertised; verify direct children and unknown-URI errors.
- For hosts, change a fixture file after its manifest is obtained: reject the
  changed bytes, refresh the entry, and renew any approval bound to old content.
  Also reject a frontmatter mismatch and a read absent from the held manifest;
  newly listed files must not reach the model before refresh and required approval.
- For hosts, offer the same name/URI from two servers and confirm distinct identity
  and cache paths. Reading a resource through a generic browser must not activate it.

Use the current MCP conformance tooling when available; confirm its supported
revision and command syntax before invoking it. A metadata/schema check alone
does not demonstrate that a target host discovers and activates the skill.
