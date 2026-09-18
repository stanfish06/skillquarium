import type { Task } from "../../src/types.ts";

/** Baseline-only: no C skill in the vault yet. */
export const task: Task = {
  id: "c-run-length",
  lang: "c",
  prompt: await Bun.file(new URL("prompt.md", import.meta.url)).text(),
  bench: true,
  spec: true,
  traits: [
    {
      id: "c-no-unsafe-string-fns",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\b(?:gets|strcpy|strcat|sprintf)\s*\(`,
      prescribedBy: [],
      note: "blind quality trait — unbounded string functions",
      fixture: {
        satisfies: `memcpy(out, in, n);`,
        violates: `strcpy((char *)out, (const char *)in);`,
      },
    },
    {
      id: "c-no-heap",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\b(?:malloc|calloc|realloc)\s*\(`,
      prescribedBy: [],
      note: "blind quality trait — the caller owns both buffers, nothing to allocate",
      fixture: {
        satisfies: `if (pos < cap) out[pos] = b;`,
        violates: `unsigned char *tmp = malloc(n * 2);`,
      },
    },
    {
      id: "c-no-stdio",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`#include\s*<stdio\.h>|\bprintf\s*\(`,
      prescribedBy: [],
      note: "blind quality trait — a codec does no I/O",
      fixture: {
        satisfies: `#include <stddef.h>`,
        violates: `#include <stdio.h>\nprintf("%zu\\n", n);`,
      },
    },
  ],
};
