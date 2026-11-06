import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { OverrideResult } from "./overrides";

const SOURCE = "scottnarmstrong/LeanAutoformalizationSkills";
const FILES = [
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "LICENSES/Apache-2.0.txt",
  "SOURCES.md",
  "PROVENANCE.md",
  "INDEX.md",
] as const;
const Pin = z.object({
  source: z.literal(SOURCE),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  skills: z.record(z.string().regex(/^[a-z0-9-]+$/), z.string().regex(/^[a-f0-9]{40}$/)),
  files: z.record(z.enum(FILES), z.string().regex(/^[a-f0-9]{64}$/)),
});
const Lock = z.object({
  skills: z.record(
    z.string(),
    z.object({ source: z.string().optional(), skillFolderHash: z.string().optional() }).passthrough(),
  ),
});

/** Restore notices after the skills CLI replaces a folder; reject updates beyond the reviewed pin. */
export function applyLeanAttribution(root: string, write: boolean): OverrideResult {
  const result: OverrideResult = { pending: [], applied: [], stale: [], missing: [] };
  const common = join(root, "skills", "lean-autoformalization-common");
  const lockPath = join(root, ".skill-lock.json");
  if (!existsSync(lockPath)) {
    if (existsSync(common)) throw new Error("Lean attribution requires .skill-lock.json");
    return result;
  }
  const lockText = readFileSync(lockPath, "utf8");
  if (!existsSync(common) && !lockText.includes(SOURCE)) return result;
  const lock = Lock.parse(JSON.parse(lockText));
  const pin = Pin.parse(JSON.parse(readFileSync(join(common, "manifest.json"), "utf8")));
  const resources = new Map<string, string>();
  for (const file of FILES) {
    const bytes = readFileSync(join(common, file));
    if (createHash("sha256").update(bytes).digest("hex") !== pin.files[file]) {
      throw new Error(`Lean attribution: ${file} differs from manifest.json; refresh the reviewed bundle`);
    }
    resources.set(file, bytes.toString("utf8"));
  }
  const names = new Set([
    ...Object.keys(pin.skills),
    ...Object.entries(lock.skills)
      .filter(([, entry]) => entry.source === SOURCE)
      .map(([name]) => name),
  ]);
  const upstream = `https://github.com/${SOURCE}/blob/${pin.revision}`;
  for (const skill of [...names].sort()) {
    const entry = lock.skills[skill];
    if (!pin.skills[skill] || entry?.source !== SOURCE || entry.skillFolderHash !== pin.skills[skill]) {
      result.stale.push(`${skill}/attribution-pin`);
      continue;
    }
    for (const [file, original] of resources) {
      let text = original;
      if (file === "INDEX.md") {
        text = text.replace(/\]\(\.\.\/([a-z0-9-]+)\/SKILL\.md\)/g, (_, name: string) =>
          name === skill ? "](SKILL.md)" : `](${upstream}/skills/${name}/SKILL.md)`,
        );
      }
      if (file === "PROVENANCE.md") {
        text += `\n## Skillquarium adaptation\n\nBundled from [${SOURCE}](${upstream}) at revision \`${pin.revision}\`.\nResource links are local to each installed skill. Reviewed script and documentation corrections\nare recorded in [Skillquarium's local overrides](https://github.com/stanfish06/skillquarium/blob/master/.skill-vault/data/local-overrides.json).\n`;
      }
      const path = join(root, "skills", skill, file);
      const label = `${skill}/attribution-${file.replaceAll("/", "-")}`;
      if (existsSync(path) && readFileSync(path, "utf8") === text) {
        result.applied.push(label);
      } else {
        result.pending.push(label);
        if (write) {
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, text, "utf8");
        }
      }
    }
  }
  return result;
}
