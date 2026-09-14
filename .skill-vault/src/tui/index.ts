import { resolve } from "node:path";
import { createCliRenderer } from "@opentui/core";

import { SkillquariumApp } from "./app";
import { PythonSkillBackend } from "./backend";
import { FsEvalSource } from "./evalruns";

// Boot the OpenTUI renderer against the Python backend; resolves when the renderer exits.
export async function runTui(root: string, query: string): Promise<number> {
  const backend = new PythonSkillBackend(root, resolve(import.meta.dir, "../../skill_toggle.py"));
  const catalog = await backend.catalog();
  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    exitOnCtrlC: true,
    useMouse: true,
    autoFocus: true,
    consoleMode: "disabled",
    backgroundColor: "#111318",
  });

  renderer.setTerminalTitle("Skillquarium");
  new SkillquariumApp(renderer, backend, catalog, query, new FsEvalSource(resolve(root, "eval")));
  return 0;
}
