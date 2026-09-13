import { resolve } from "node:path";
import { REPO_DIR } from "../../src/config.ts";
import type { SkillDef } from "../../src/types.ts";

export const skill: SkillDef = {
  id: "modern-typescript",
  dir: resolve(REPO_DIR, "skills/modern-typescript"),
  injection: "prose",
};
