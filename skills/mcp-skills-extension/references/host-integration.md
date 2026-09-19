# Host integration

These requirements summarize the
[reviewed stable specification](https://github.com/modelcontextprotocol/ext-skills/blob/0e85d4db8860a305c857f26fdede64f416675b92/specification/stable/skills.mdx).
Read its full Integrity and Verification and Security Considerations sections when
implementing the corresponding host behavior.

## Discovery and identity

- Observe the server's extension declaration before issuing `skills/list` or
  `skills/get`. Invoke directory reads only with `directoryRead: true`.
- Each listed entry is complete; fetching `skills/get` again is unnecessary to
  complete it. Support direct lookup by URI because listings may be partial or empty.
- Identify a skill by `(host-assigned server identity, SKILL.md URI)` throughout
  registries, approvals, caches, and model-callable access paths. A name or URI
  alone cannot identify skills across servers. Do not infer skill identity from
  the `skill://` scheme alone.
- Disambiguate equal names within a server and across origins. Remote skills must
  not silently replace local skills or another server's skills.

## Activation and verified reads

1. Retain the entry used to load the skill for at least as long as its `SKILL.md`
   remains in model context. This is the held manifest for subsequent reads.
2. Fetch `SKILL.md` when loading it, and supporting files only when read. Do not
   prefetch files on connection, listing, or approval. A generic resource read
   alone must not activate the skill or its frontmatter.
3. For an array manifest, verify each file's raw byte size and SHA-256 digest before
   use. Reject unlisted files even if a live directory listing now includes them.
   A directory listing does not expand the held manifest. Do not expose newly
   listed files to the model as skill files until the entry is refreshed and any
   required approval renewed.
4. Parse the retrieved `SKILL.md` and compare every frontmatter field with the
   entry, including for `resources: "dynamic"`. Reject discrepancies. Missing or
   malformed `resources` is invalid, not an implicit dynamic skill.
5. On verification failure, stop using the failed content and obtain a fresh entry
   through `skills/get` or `skills/list`. These failures are host decisions, not
   new JSON-RPC error codes. Apply the approval rules below before resuming.

For manifest-backed skills, directory contents can be derived from the held
manifest without another request. Dynamic skills have no digest guarantees; a host
may refuse them. Hashes prove consistency with the server's manifest, not that the
server or skill content is trustworthy.

## Origin and approvals

- Tag skill content with its originating server when it enters model context.
  Treat it as server-provided input with no elevated instruction authority.
- Bind model-callable resource reads to that server using a host-assigned label,
  not self-reported `serverInfo.name`. Cross-server resource reads require explicit
  approval for each call, naming both servers.
- Require explicit per-skill user approval before skill content causes host-side
  code execution, whether via declarative hooks/scripts or instructions that call
  a local execution tool. This includes arbitrary commands as well as bundled scripts.
- Ignore `allowed-tools` unless the user explicitly approves that permission grant
  for the particular skill. Loading content does not confer expanded permissions.
- A nested `SKILL.md` read as supporting content is ordinary Markdown. Activating
  it as another skill requires fresh, explicit consent; parent approval does not
  activate it or approve its frontmatter.
- General loading approval is governed by host/user policy; the reviewed spec
  permits a per-skill or per-server loading gate. Keep that distinct from the
  explicit execution, permission, nested-activation, and cross-server gates above.
- Any persisted per-skill approval binds to the complete set of resource URIs and
  digests. A refreshed entry with an added, removed, or changed file revokes it;
  obtain approval again before loading or executing. Persisted approval cannot
  cover arbitrary future bytes from a dynamic skill.

## Cache behavior

Cache verified files on demand. Include server identity and URI in materialized
paths, and keep the cache outside all local filesystem-skill discovery paths.
Preserve the MCP origin after restart or disconnection.

Partition caches by authorization context. `cacheScope: "public"` marks a response
without user-specific data that may be shared; a `"private"` `skills/list`,
`skills/get`, or `resources/read` result may be reused only within the authorization
context that produced it, so its cache key includes that context (for example the
access token) together with server identity and URI. `ttlMs` and `cacheScope` are
freshness and sharing hints, not integrity properties; the digest checks in this
guide apply to every cached read.

Either make cached files immutable in a location writable only by the host, or
recompute their byte digests against the held entry on every access. A stored hash
label or modification time does not verify mutable cached bytes. Local storage
does not remove the execution or permission gates on MCP-origin content.
