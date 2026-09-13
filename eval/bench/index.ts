import type { Lang } from "../src/types.ts";
import type { LangModule } from "./common.ts";
import { ts } from "./ts.ts";
import { go_ } from "./go.ts";
import { rust } from "./rust.ts";
import { c, cpp } from "./c.ts";
import { csharp } from "./csharp.ts";

export const MODULES: Record<Lang, LangModule> = { ts, go: go_, rust, c, cpp, csharp };

export function moduleFor(lang: Lang): LangModule {
  const m = MODULES[lang];
  if (!m) throw new Error(`no language module for ${lang}`);
  return m;
}

export type { LangModule, GateResult, BenchOutcome } from "./common.ts";
