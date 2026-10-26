// Rewrite fixtures/catalog.golden.json and fixtures/list.golden.tsv from the current tree.
// The goldens pin catalog/list output, which carries every skill's description, so they follow
// skill content: update-skills.yml and rebuild-index.yml run this before `bun test`, and a PR that
// changes the output on purpose runs it too (`bun run --cwd .skill-vault fixtures`).
// Host-local values are normalized so every host writes the same bytes: `directory` relative to the
// vault root, and toggle state (which the tests skip) as "local" / null.
import { writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pyJsonDumps } from "../src/toggle/state";

const ROOT = resolve(import.meta.dir, "..", "..");
const FIXTURES = join(import.meta.dir, "fixtures");

function cli(command: string): string {
  const proc = Bun.spawnSync([join(ROOT, "skillquarium"), command], { stdout: "pipe", stderr: "inherit" });
  if (proc.exitCode !== 0) throw new Error(`skillquarium ${command} exited ${proc.exitCode}`);
  return proc.stdout.toString("utf8");
}

interface Row {
  key: string;
  directory: string;
  claude_enabled: boolean | null;
  codex_enabled: boolean | null;
  state: string;
  error: string | null;
}

const catalog = JSON.parse(cli("catalog")) as { skills: Row[]; categories: string[] };
// `catalog` exits 0 with an error row for a skill it cannot read; blessing that row into the golden
// would let the tests accept a broken skill, so refuse and leave the old fixtures in place.
const broken = catalog.skills.filter((skill) => skill.error !== null);
if (broken.length) {
  for (const skill of broken) console.error(`${skill.key}: ${skill.error}`);
  console.error(`regenerateGoldens: ${broken.length} skill(s) have catalog errors; fixtures not written`);
  process.exit(1);
}
for (const skill of catalog.skills) {
  skill.directory = relative(ROOT, skill.directory);
  skill.claude_enabled = null;
  skill.codex_enabled = null;
  skill.state = "local";
}
writeFileSync(join(FIXTURES, "catalog.golden.json"), `${pyJsonDumps(catalog)}\n`, "utf8");
// Row is `state\tkey\tcategory\tdescription`.
const list = cli("list").replace(/^[^\t\n]*\t/gm, "local\t");
writeFileSync(join(FIXTURES, "list.golden.tsv"), list, "utf8");
