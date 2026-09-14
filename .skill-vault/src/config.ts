import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

// Layers, lowest to highest: schema defaults, .skill-vault/config.json (committed),
// .skill-vault/config.local.json (gitignored), then SKILLQUARIUM_* / CLAUDE_SKILLS_DIR /
// SKILLS_CLI_VERSION env vars.
const Schema = z.object({
  skillsCliVersion: z.string().default("1.5.23"),
  claudeSkillsDir: z.string().default(join(homedir(), ".claude/skills")),
  embed: z
    .object({
      url: z.url().default("http://127.0.0.1:8080"),
      model: z.string().nullable().default(null),
      batchSize: z.number().int().positive().default(16),
      timeoutMs: z.number().int().positive().default(120_000),
      retries: z.number().int().min(0).default(3),
    })
    .prefault({}),
  query: z
    .object({
      k: z.number().int().positive().default(8),
      rrfK: z.number().positive().default(60),
      weights: z
        .object({
          lexical: z.number().default(1),
          fuzzy: z.number().default(1),
          semantic: z.number().default(1),
        })
        .prefault({}),
    })
    .prefault({}),
});
export type Config = z.infer<typeof Schema>;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Read a JSON file as a plain object; a missing file is an empty layer, a non-object is an error.
async function readLayer(path: string): Promise<Obj> {
  const f = Bun.file(path);
  if (!(await f.exists())) return {};
  const data: unknown = await f.json();
  if (!isObj(data)) throw new Error(`config: ${path}: expected a JSON object`);
  return data;
}

// Merge b into a; nested objects merge recursively, everything else (arrays included) replaces.
function deepMerge(a: Obj, b: Obj): Obj {
  const out: Obj = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    out[k] = isObj(v) && isObj(cur) ? deepMerge(cur, v) : v;
  }
  return out;
}

function envLayer(): Obj {
  const env: Obj = {};
  const embed: Obj = {};
  if (process.env.SKILLQUARIUM_EMBED_URL) embed.url = process.env.SKILLQUARIUM_EMBED_URL;
  if (process.env.SKILLQUARIUM_EMBED_MODEL) embed.model = process.env.SKILLQUARIUM_EMBED_MODEL;
  if (Object.keys(embed).length > 0) env.embed = embed;
  if (process.env.CLAUDE_SKILLS_DIR) env.claudeSkillsDir = process.env.CLAUDE_SKILLS_DIR;
  if (process.env.SKILLS_CLI_VERSION) env.skillsCliVersion = process.env.SKILLS_CLI_VERSION;
  return env;
}

export async function loadConfig(root: string): Promise<Config> {
  const committed = await readLayer(join(root, ".skill-vault/config.json"));
  const local = await readLayer(join(root, ".skill-vault/config.local.json"));
  const merged = deepMerge(deepMerge(committed, local), envLayer());
  const parsed = Schema.safeParse(merged);
  if (!parsed.success) {
    // Report the first issue with its dotted path so the user can find the offending key.
    const issue = parsed.error.issues[0];
    const where = issue ? issue.path.map(String).join(".") : "";
    throw new Error(`config: ${where}: ${issue?.message ?? "invalid"}`);
  }
  return parsed.data;
}
