import type { Task } from "../../src/types.ts";

const CP = ["cpp-pro"];

export const task: Task = {
  id: "cpp-lru-cache",
  lang: "cpp",
  prompt: await Bun.file(new URL("prompt.md", import.meta.url)).text(),
  bench: true,
  spec: true,
  traits: [
    {
      id: "cpp-no-raw-new",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\bnew\s+[\w:<]|\bdelete\s*(?:\[\s*\])?\s+\w`,
      prescribedBy: CP,
      note: "cpp-pro MUST NOT: raw new/delete",
      fixture: {
        satisfies: `auto node = std::make_unique<Node>();`,
        violates: `Node* node = new Node(); delete node;`,
      },
    },
    {
      id: "cpp-concept",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`\bconcept\s+\w+|\brequires\s*[\w(<]`,
      prescribedBy: CP,
      note: "cpp-pro MUST: concepts for template constraints",
      fixture: {
        satisfies: `template <typename K> requires std::equality_comparable<K>\nclass C {};`,
        violates: `template <typename K, typename V>\nclass LruCache {};`,
      },
    },
    {
      id: "cpp-no-using-namespace-std",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\busing\s+namespace\s+std\s*;`,
      prescribedBy: CP,
      note: "cpp-pro MUST NOT: using namespace std in headers",
      fixture: {
        satisfies: `std::size_t n = 0;`,
        violates: `using namespace std;\nsize_t n = 0;`,
      },
    },
    {
      id: "cpp-noexcept",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`\bnoexcept\b`,
      prescribedBy: CP,
      note: "cpp-pro: Core Guidelines, noexcept on moves and non-throwing accessors",
      fixture: {
        satisfies: `LruCache(LruCache&& other) noexcept = default;`,
        violates: `LruCache(LruCache&& other) = default;`,
      },
    },
    {
      id: "cpp-no-c-cast",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`(?<![\w>)\]])\((?:int|unsigned|long|short|char|size_t|std::size_t|double|float|bool)\s*\*?\)\s*[\w(]`,
      prescribedBy: CP,
      note: "cpp-pro MUST NOT: C-style casts",
      fixture: {
        satisfies: `auto n = static_cast<int>(x);\nvoid f(int);`,
        violates: `int n = (int)x;`,
      },
    },
    {
      id: "cpp-no-iostream",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`#include\s*<iostream>|std::cout|\bprintf\s*\(`,
      prescribedBy: [],
      note: "blind quality trait — a container header does no I/O",
      fixture: {
        satisfies: `#include <optional>`,
        violates: `#include <iostream>\nstd::cout << "x";`,
      },
    },
    {
      id: "cpp-no-c-headers",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`#include\s*<(?:stdio|stdlib|string|assert|stdint|stddef)\.h>`,
      prescribedBy: [],
      note: "blind quality trait — <cstddef> not <stddef.h>",
      fixture: {
        satisfies: `#include <cstddef>`,
        violates: `#include <stdlib.h>`,
      },
    },
  ],
};
