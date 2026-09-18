import { resolve } from "node:path";
import { REPO_DIR } from "../../src/config.ts";
import type { SkillDef } from "../../src/types.ts";

export const skill: SkillDef = {
  id: "cpp-pro",
  dir: resolve(REPO_DIR, "skills/cpp-pro"),
  injection: "prose",
};
