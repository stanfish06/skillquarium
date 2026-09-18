import type { Task } from "../../src/types.ts";

const RG = ["rust-coding-guidelines"];

export const task: Task = {
  id: "rust-record-parser",
  lang: "rust",
  prompt: await Bun.file(new URL("prompt.md", import.meta.url)).text(),
  bench: true,
  spec: true,
  traits: [
    {
      id: "rs-newtype",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`\bstruct\s+\w+\s*\(\s*(?:pub(?:\(\w+\))?\s+)?String\s*\)\s*;`,
      prescribedBy: RG,
      note: "coding-guidelines: newtypes for domain semantics (struct Email(String))",
      fixture: {
        satisfies: `pub struct Email(String);`,
        violates: `pub struct Record { email: String }`,
      },
    },
    {
      id: "rs-with-capacity",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`\bwith_capacity\(`,
      prescribedBy: RG,
      note: "coding-guidelines: pre-allocate",
      fixture: {
        satisfies: `let mut out = Vec::with_capacity(input.lines().count());`,
        violates: `let mut out = Vec::new();`,
      },
    },
    {
      id: "rs-no-unwrap",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\.unwrap\(\)`,
      prescribedBy: RG,
      note: "coding-guidelines: expect() over unwrap()",
      fixture: {
        satisfies: `let age: u8 = field.parse().map_err(|_| err(line))?;`,
        violates: `let age: u8 = field.parse().unwrap();`,
      },
    },
    {
      id: "rs-question-mark",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`[\w)\]]\?(?=[\s;,.)\]])`,
      prescribedBy: RG,
      note: "coding-guidelines: ? propagation",
      fixture: {
        satisfies: `let age: u8 = field.parse().map_err(|_| err(line))?;`,
        violates: `let age: u8 = match field.parse() { Ok(v) => v, Err(_) => return Err(e) };`,
      },
    },
    {
      id: "rs-no-panic",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\bpanic!\s*\(`,
      prescribedBy: [],
      note: "blind quality trait — a parser returns errors",
      fixture: {
        satisfies: `return Err(ParseError { line, reason });`,
        violates: `panic!("bad line {line}");`,
      },
    },
    {
      id: "rs-no-todo",
      polarity: "forbid",
      kind: "regex",
      pattern: String.raw`\b(?:todo|unimplemented)!\s*\(`,
      prescribedBy: [],
      note: "blind quality trait — no stubs",
      fixture: {
        satisfies: `fn line(&self) -> usize { self.line }`,
        violates: `fn line(&self) -> usize { todo!() }`,
      },
    },
    {
      id: "rs-derive-debug",
      polarity: "require",
      kind: "regex",
      pattern: String.raw`#\[derive\([^)]*\bDebug\b`,
      prescribedBy: [],
      note: "blind quality trait — public types derive Debug",
      fixture: {
        satisfies: `#[derive(Debug, Clone)]\npub struct Record { name: String }`,
        violates: `pub struct Record { name: String }`,
      },
    },
  ],
};
