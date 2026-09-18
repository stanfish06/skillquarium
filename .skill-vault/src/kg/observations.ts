import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pyStrip, universalNewlines } from "../catalog";
import { pyCompare } from "./ngram";

/** One usage episode. Only `used`, `outcome` and `ts` are read; the rest is carried as-is. */
export interface Episode {
  used: unknown[];
  outcome?: unknown;
  ts?: unknown;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Usage episodes. Append-only JSONL; malformed lines are skipped, not fatal. */
export function loadObservations(observationsDir: string): Episode[] {
  const episodes: Episode[] = [];
  if (!isDir(observationsDir)) return episodes;
  const files = readdirSync(observationsDir)
    .filter((name) => !name.startsWith(".") && name.endsWith(".jsonl"))
    .sort(pyCompare);
  for (const name of files) {
    const text = universalNewlines(readFileSync(join(observationsDir, name), "utf8"));
    for (const raw of text.split("\n")) {
      const line = pyStrip(raw);
      if (!line || line.startsWith("#")) continue;
      let ep: unknown;
      try {
        ep = JSON.parse(line);
      } catch {
        continue;
      }
      // A record is an object with a list of used skills; anything else is malformed.
      if (typeof ep !== "object" || ep === null || Array.isArray(ep)) continue;
      const record = ep as Record<string, unknown>;
      if (!Array.isArray(record.used)) continue;
      episodes.push({ used: record.used, outcome: record.outcome, ts: record.ts });
    }
  }
  return episodes;
}
