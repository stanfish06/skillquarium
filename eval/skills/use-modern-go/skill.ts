import { resolve } from "node:path";
import { z } from "zod";
import { REPO_DIR } from "../../src/config.ts";
import type { SkillDef } from "../../src/types.ts";

const dir = resolve(REPO_DIR, "skills/use-modern-go");
const GO_VERSION = "1.27";

export const skill: SkillDef = {
  id: "use-modern-go",
  dir,
  injection: "tool",
  version: async () => (await Bun.file(resolve(dir, "scripts/VERSION")).text().catch(() => "unknown")).trim(),
  tools: {
    command: ["sh", resolve(dir, "scripts/run-tool.sh")],
    bridgeNote:
      "Mechanism note: the CLI described above is exposed to you as the " +
      "tools `go_guidelines_list` and `go_guidelines_explain`. Call those tools " +
      "instead of shell commands. Everything else in the instructions applies " +
      "unchanged.",
    tools: {
      go_guidelines_list: {
        description:
          "List the modern Go guidelines that apply to a Go version. Returns one line per guideline, newest first. Read the whole list.",
        inputSchema: z.object({ goVersion: z.string().describe("e.g. 1.27") }),
        args: ({ goVersion }) => ["list", "--go-version", goVersion || GO_VERSION],
      },
      go_guidelines_explain: {
        description:
          "Explain specific guideline IDs, with details and before/after examples. Pass only the IDs you intend to apply.",
        inputSchema: z.object({ ids: z.array(z.string()).min(1) }),
        args: ({ ids }) => ["explain", ...(ids as string[]).slice(0, 12)],
      },
    },
    maxSteps: 8,
    timeoutMs: 120_000,
  },
};
