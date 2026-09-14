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
  // Resolve once the renderer is gone (q/Escape call destroy(); Ctrl-C does too via exitOnCtrlC).
  // The "destroy" event fires before the terminal is restored, so defer to the next macrotask.
  return new Promise<number>((done) => {
    renderer.on("destroy", () => setImmediate(() => done(0)));
  });
}
