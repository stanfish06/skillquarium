---
name: modern-typescript
description: Modern TypeScript 5.x idioms — strict tsconfig (strict, noUncheckedIndexedAccess), the type system (unions/intersections, generics + constraints, narrowing, discriminated unions, unknown vs any, utility types, satisfies, as const, template-literal types), ESM & moduleResolution, and type-safe patterns (branded types, exhaustiveness). Use when configuring a tsconfig, writing or reviewing type-safe TypeScript, designing generics or a discriminated union, or decoding a tsc error.
license: MIT
metadata: {"version": "1.0", "skill-author": "vault-audit"}
---

# Modern TypeScript

## Overview

Guidance for idiomatic TypeScript on current stable **5.x** (as of 2026). The goal: let the
compiler prove things so you don't have to test them. Modern TS means `strict` on from day one,
letting inference do the work, reserving `any` for genuine escape hatches, and using unions +
narrowing instead of runtime type tags. TypeScript's type system is **structural** (shape-based,
not name-based) — internalizing that explains most surprises.

This skill covers the type system and compiler config. It is framework-agnostic: for React/Next
specifics see the frontend skills noted at the bottom.

## Setup

Install and initialize:

```bash
npm i -D typescript          # or: pnpm add -D typescript
npx tsc --init               # scaffolds tsconfig.json
npx tsc --noEmit             # type-check only (bundler does the emit)
```

**Strict baseline `tsconfig.json`.** Every option below is a real, documented 5.x flag — do not
substitute made-up names.

```jsonc
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2023"],                    // add "dom","dom.iterable" for browser code
    "module": "nodenext",                 // Node: nodenext | bundler apps: "preserve"
    "moduleResolution": "nodenext",       // bundlers (Vite/esbuild/webpack): "bundler"
    "moduleDetection": "force",           // treat every file as a module (no accidental globals)

    // Correctness — the important half
    "strict": true,                       // umbrella: noImplicitAny, strictNullChecks,
                                          //   strictFunctionTypes, useUnknownInCatchVariables, ...
    "noUncheckedIndexedAccess": true,     // arr[i] and record[k] become T | undefined
    "exactOptionalPropertyTypes": true,   // `x?: T` cannot be explicitly set to undefined
    "noImplicitOverride": true,           // require `override` keyword
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Module hygiene
    "verbatimModuleSyntax": true,         // forces `import type`; predictable emit, no elision
    "isolatedModules": true,              // safe for per-file transpilers (esbuild/swc/babel)
    "esModuleInterop": true,
    "skipLibCheck": true,                 // skip checking .d.ts of deps (faster, standard)

    // Emit (drop if a bundler emits and you only type-check)
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "noEmit": true                        // remove when tsc is the emitter
  }
}
```

Rules of thumb: **Node/library** → `module`+`moduleResolution` both `"nodenext"`.
**App built by a bundler** → `"module": "preserve"`, `"moduleResolution": "bundler"`, `"noEmit": true`.
`noUncheckedIndexedAccess` is the single highest-value flag not included in `strict` — turn it on.

## Core patterns

**`unknown`, never `any`, at boundaries.** `any` disables checking and spreads silently; `unknown`
forces a narrow before use.

```ts
const data: unknown = JSON.parse(raw);      // JSON.parse returns any — annotate to unknown
if (typeof data === "object" && data !== null && "id" in data) {
  // data narrowed; validate the rest with a schema lib (zod/valibot) for real safety
}
```

**Narrowing** via control-flow analysis — `typeof`, `instanceof`, `in`, truthiness, equality:

```ts
function len(x: string | string[]): number {
  return typeof x === "string" ? x.length : x.length; // each branch narrowed
}
```

**Discriminated (tagged) unions** — the workhorse for modeling states. A shared literal
`kind`/`type` field lets TS narrow the whole object:

```ts
type Result<T> =
  | { kind: "ok"; value: T }
  | { kind: "err"; error: Error };

function unwrap<T>(r: Result<T>): T {
  switch (r.kind) {
    case "ok":  return r.value;      // r is the ok variant here
    case "err": throw r.error;
  }
}
```

**Exhaustiveness checks** with `never` — the compiler flags a missing case when the union grows:

```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
// in the switch: default: return assertNever(r);  // TS2345 if a case is unhandled
```

**Generics with constraints** — accept the least you need; let call sites infer the rest:

```ts
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];                    // return type is precise, not `unknown`
}
const name = pluck({ id: 1, name: "a" }, "name"); // typed as string
```

**`as const`** freezes literals to their narrowest readonly type; **`satisfies`** validates a value
against a type *without widening* it (you keep the precise inferred type):

```ts
const ROUTES = { home: "/", user: "/u/:id" } as const;
// typeof ROUTES.home === "/"  (literal, readonly)

const config = {
  port: 3000,
  env: "prod",
} satisfies Record<string, string | number>;   // checked, but config.port stays `number`
```

**Utility types** — reach for the built-ins before writing mapped types by hand:
`Partial<T>`, `Required<T>`, `Readonly<T>`, `Pick<T,K>`, `Omit<T,K>`, `Record<K,V>`,
`Exclude<U,X>`, `Extract<U,X>`, `NonNullable<T>`, `ReturnType<F>`, `Parameters<F>`,
`Awaited<T>`, and `NoInfer<T>` (5.4, blocks inference from a given position).

**Template-literal types** for string-shaped APIs:

```ts
type Event = `on${Capitalize<"click" | "hover">}`;   // "onClick" | "onHover"
type Hex = `#${string}`;
```

**Branded (nominal) types** — defeat structural typing when two `string`s must not mix:

```ts
type UserId = string & { readonly __brand: "UserId" };
const toUserId = (s: string) => s as UserId;
function load(id: UserId) { /* ... */ }
// load("raw") -> TS2345: plain string not assignable to UserId
```

**Custom type guards & assertion functions** encapsulate narrowing:

```ts
function isString(x: unknown): x is string { return typeof x === "string"; }
function assertDefined<T>(x: T): asserts x is NonNullable<T> {
  if (x == null) throw new Error("expected defined");
}
```

## Gotchas / best practices

- **`any`-creep.** One `any` (a cast, an untyped dep, `JSON.parse`) silently infects everything it
  touches. Prefer `unknown` at boundaries; `strict` (via `noImplicitAny`) catches implicit ones,
  but explicit `any` and third-party `any` slip through — grep for them in review.
- **Structural typing surprises.** Types match by shape, so an object with *extra* properties is
  assignable to a narrower type — **except** the excess-property check fires only on fresh object
  *literals*. Assigning through a variable bypasses it. Two unrelated types with the same shape are
  interchangeable; use branded types when identity matters.
- **`Object.keys` / `for..in` return `string[]`**, not `(keyof T)[]` — deliberately, since objects
  can hold extra keys at runtime. Cast or re-validate rather than assuming.
- **ESM/CJS interop.** With `verbatimModuleSyntax`, type-only imports **must** use `import type`
  (else TS2823-style emit errors). Under `nodenext` ESM, relative imports need explicit
  extensions (`./x.js`, even from `x.ts`), and the package must declare `"type": "module"`.
  `esModuleInterop` makes `import x from "cjs-pkg"` work.
- **enum vs union.** Prefer a **union of string literals** or an `as const` object over `enum`.
  Numeric `enum`s are unsafe (any `number` is assignable to them); `const enum` breaks under
  `isolatedModules`/`verbatimModuleSyntax`. Literal unions are erasable, tree-shakeable, and
  narrow cleanly.
- **Don't over-annotate.** Let inference type locals and return values; annotate function
  *parameters*, public API boundaries, and empty containers (`const xs: string[] = []`).
- **Reading common `tsc` errors:**
  | Code | Meaning | Usual fix |
  |------|---------|-----------|
  | TS2322 | Type X not assignable to Y | shape/variance mismatch; check the diff TS prints |
  | TS2345 | Argument X not assignable to parameter Y | wrong arg type (also fired by `assertNever`) |
  | TS2339 | Property does not exist on type | narrow first, or type is wrong/too wide |
  | TS18048 / TS2532 | X is possibly 'undefined' | guard it; effect of `strictNullChecks`/`noUncheckedIndexedAccess` |
  | TS18047 | X is possibly 'null' | null guard |
  | TS7006 | Parameter implicitly has 'any' | add a parameter annotation |
  | TS18046 | X is of type 'unknown' | narrow before use |
  | TS2769 | No overload matches this call | args match no signature; read each listed overload |
  | TS2367 | Comparison appears unintentional | comparing non-overlapping types (often a bug) |

## Use this vs related skills

`modern-python` is the Python analogue (tooling + idioms); for React/Next specifics use the
frontend framework and design skills (e.g. `vercel-react-best-practices`) — this skill is the
language/type-system and `tsconfig` layer beneath them.
