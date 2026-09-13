import type { Task } from "../../src/types.ts";

const CS = ["csharp-developer"];

export const task: Task = {
  id: "csharp-order-parser",
  lang: "csharp",
  prompt: await Bun.file(new URL("prompt.md", import.meta.url)).text(),
  bench: true,
  spec: true,
  traits: [
    {
      id: "cs-file-scoped-namespace",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`^\s*namespace\s+[\w.]+\s*;\s*$`,
      prescribedBy: CS,
      note: "csharp-developer MUST: file-scoped namespaces",
      fixture: {
        satisfies: `namespace Orders;\n\npublic sealed class A { }`,
        violates: `namespace Orders\n{\n    public sealed class A { }\n}`,
      },
    },
    {
      id: "cs-record",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`\brecord\b`,
      prescribedBy: CS,
      note: "csharp-developer: records for data types, record struct Result pattern",
      fixture: {
        satisfies: `public sealed record Order(string Id, int Quantity, decimal UnitPrice);`,
        violates: `public sealed class Order { public string Id { get; } = ""; }`,
      },
    },
    {
      id: "cs-primary-ctor",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`(?<!record\s)(?<!record\s\s)\b(?:class|struct)\s+\w+(?:<[^>]*>)?\s*\(`,
      prescribedBy: CS,
      note: "csharp-developer MUST: primary constructors (C# 12)",
      fixture: {
        satisfies: `public sealed class OrderParseResult(bool ok, string? error)\n{\n}`,
        violates: `public sealed class OrderParseResult\n{\n    public OrderParseResult(bool ok) { }\n}`,
      },
    },
    {
      id: "cs-invariant-culture",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`\bInvariantCulture\b|\bNumberStyles\.`,
      prescribedBy: [],
      note: "blind quality trait — culture-invariant numeric parsing",
      fixture: {
        satisfies: `decimal.TryParse(s, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var p)`,
        violates: `decimal.TryParse(s, out var p)`,
      },
    },
    {
      id: "cs-tryparse",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`\.TryParse\(`,
      prescribedBy: [],
      note: "blind quality trait — no exception-driven parsing",
      fixture: {
        satisfies: `if (!int.TryParse(s, out var q)) return Fail(line);`,
        violates: `try { q = int.Parse(s); } catch (FormatException) { return Fail(line); }`,
      },
    },
    {
      id: "cs-no-console",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\bConsole\.\w+\(`,
      prescribedBy: [],
      note: "blind quality trait — a parser does no I/O",
      fixture: {
        satisfies: `return OrderParseResult.Fail(line, "bad quantity");`,
        violates: `Console.WriteLine("bad quantity");`,
      },
    },
    {
      id: "cs-no-dynamic",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\bdynamic\b`,
      prescribedBy: [],
      note: "blind quality trait",
      fixture: {
        satisfies: `object value = 1;`,
        violates: `dynamic value = 1;`,
      },
    },
  ],
};
