import { resolve } from "node:path";
import { createCliRenderer } from "@opentui/core";

import { loadTier1Views } from "../eval/tier1Results";
import { SkillquariumApp, type Tier1State } from "./app";
import { LocalSkillBackend } from "./backend";
import { FsEvalSource } from "./evalruns";

// Boot the OpenTUI renderer over the in-process toggle backend; resolves when the renderer is destroyed.
export async function runTui(root: string, query: string): Promise<number> {
  const backend = new LocalSkillBackend(root);
  const catalog = await backend.catalog();
  // A corrupt results file must not stop the browser; the detail pane shows why instead.
  let tier1: Tier1State;
  try {
    tier1 = { views: loadTier1Views(root), error: null };
  } catch (e) {
    tier1 = { views: new Map(), error: e instanceof Error ? e.message : String(e) };
  }
  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    exitOnCtrlC: true,
    useMouse: true,
    autoFocus: true,
    consoleMode: "disabled",
    backgroundColor: "#111318",
  });

  // A boot failure must tear the renderer down so the terminal leaves the alternate screen.
  try {
    renderer.setTerminalTitle("Skillquarium");
    new SkillquariumApp(renderer, backend, catalog, query, new FsEvalSource(resolve(root, "eval")), tier1);
  } catch (e) {
    renderer.destroy();
    throw e;
  }
  // q/Escape call destroy(); Ctrl-C does too via exitOnCtrlC. destroy() finishes synchronously
  // after emitting "destroy", and the process exits via exitCode once the loop drains.
  return new Promise<number>((done) => {
    renderer.on("destroy", () => done(0));
  });
}
