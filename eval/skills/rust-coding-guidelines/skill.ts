import { resolve } from "node:path";
import { REPO_DIR } from "../../src/config.ts";
import type { SkillDef } from "../../src/types.ts";

export const skill: SkillDef = {
  id: "rust-coding-guidelines",
  dir: resolve(REPO_DIR, "skills/coding-guidelines"),
  injection: "prose",
};
