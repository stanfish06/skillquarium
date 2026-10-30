---
name: google-rust-style
description: Use when writing, reviewing, or refactoring Rust code — module layout and imports, function parameter and return types (&str vs &String, slice vs &Vec, iterators, bool flags), traits and derives, Option/Result/panic, naming, doc comments, unsafe, unwrap/expect, iterator chains — or when the user asks for Google's Rust style guide, or works in Chromium, Android, or Fuchsia Rust. For the rust-coding-guidelines rule IDs (P.NAM, G.FMT, ...) use coding-guidelines instead.
metadata:
  source: https://google.github.io/styleguide/rustguide.html
  source-file: google/styleguide@gh-pages rustguide.md
  source-revision: c775c0c2 (2026-10-24)
  license: CC-BY-3.0
---

# Google Rust style

Condensed from Google's Rust Style Guide. "Style" here covers API and
implementation design, not only formatting. Each rule ends with its anchor in the
guide (`#glob-imports` → `rustguide.html#glob-imports`). Cite the anchor when you
flag a rule in review.

## How to apply it

- **Precedence.** Follow the public [Rust Style Guide](https://doc.rust-lang.org/nightly/style-guide/)
  and [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/) except where a rule
  below conflicts. rustfmt enforces most formatting. `#public-rules`
- **Library vs application code.** For library code (used by other projects, solves a general
  problem), API-design rules are binding. For application code they are strong recommendations:
  prefer simple and direct code, and don't generalize before there's a need. Several rules
  below relax for application code; that is noted where it applies. `#api-design-context`
- **Exceptions are part of the rule.** Most rules list when they don't apply. Don't flag code that
  sits inside a listed exception.
- **Codebase rules.** Rules tagged Chromium/Android/Fuchsia (last section) apply only in those
  codebases.
- **Examples.** The `references/` files hold good/bad code for the sections marked → below. Open
  one when the one-line rule isn't enough to decide a case.

## Code organization

- Name a leaf module and its file after its primary item: `Foo` lives in `mod foo` / `foo.rs`.
  Leaf modules without one primary abstraction can be named freely. `#userdefined-item`
- Non-leaf modules hold only `mod` declarations and re-exports. A leaf module may still contain
  `mod test` and binding modules like `#[cxx::bridge]`. A little "ties things together" code in a
  non-leaf module is fine. `#non-leaf-modules`
- No glob imports. Allowed: `use super::*` in inline modules (e.g. tests), `use Enum::*` inside an
  enum's methods or functions mostly about that enum, `pub use submodule::*` in non-leaf modules,
  and private merging of C++ namespaces. Don't define preludes. Third-party preludes are up to the
  reviewer. `#glob-imports`
- One `use` imports from one module: no `::` inside the braces (`imports_granularity = Module`).
  `use foo::bar::{Bar, Baz};` is fine; `use foo::{Foo, bar::Bar};` is not. `#use-statement`
- Import a trait inside the function that uses it, unless the whole file uses its methods.
  `#prefer-local-trait-imports`
- Call top-level functions from other modules through their module: `use std::mem;` then
  `mem::transmute(..)`, not `use std::mem::transmute;`. Exceptions: names already unambiguous (e.g. C++
  free functions), Chromium small single-purpose crates, module names prone to collisions.
  `#toplevel-functions`
- Import types and traits and use them unqualified (`Regex`, not `regex::Regex`). Exceptions:
  common names that would clash (`io::Error`, or `use std::io::Error as IoError`), large groups of
  related types, macros and generated code, and files where the import block would explode.
  `#type-names`

## Formatting

- Format with the codebase's tool (`rustfmt`; `git cl format` in Chromium). Recommended rustfmt
  options: `max_width = 100`, `hex_literal_case = Lower`, `format_macro_matchers = true`. Escape
  invisible characters in literals (`\u{200D}`). `#formatting-other`
- `#[rustfmt::skip]` only for deliberate manual alignment (e.g. matrices) or generated code, never
  for personal taste. `#formatting-optout`

## Ownership and borrowing

- Prefer unique ownership and borrowing over `Rc`/`Arc`. Use them when the alternative is
  unreasonably complex. That's a judgment call for review. `#avoid-rc-arc`
- `.clone()` only for a real deep copy, not to dodge the borrow checker. A clone is acceptable when
  the borrows would get very complex. Cloning `Rc`/`Arc` is expected. `#prefer-borrows`

## Function inputs and outputs → [references/api-design.md](references/api-design.md)

- Take the most flexible reference to immutable data: `&T` not `&Box<T>`, `&[T]` not `&Vec<T>`,
  `&str` not `&String`, `Option<&T>` not `&Option<T>`. Exception: non-contiguous text such as
  ropes or cords. Clippy: `borrowed_box`, `ptr_arg`. `#flexible-references`
- Return iterators (concrete or `impl Iterator`) instead of `Vec<T>` where possible. Returning a
  `Vec` is fine when most callers need one anyway, the implementation naturally builds one, the
  result gets random access, the loop is clearer and the allocation doesn't matter, the function's
  job is to build a collection, or the vector already exists. It's also fine in application code
  when that's simpler. `#return-iterators`
- Library code that only iterates its input takes `impl IntoIterator` / an iterator. A slice is
  fine in application code when that's simpler. `#accept-iterators`
- `impl Into<T>` parameters only in library APIs where call-site ergonomics really matter,
  weighed against code bloat. Application code should almost never use them. `#accepting-into`
- Use an `enum` parameter instead of a `bool` whose meaning isn't obvious at the call site. If you
  keep the `bool`, label it at call sites with an inline comment. `#enum-vs-bool`
- Pick the error mechanism by contract. `Option` when the cause is obvious and details wouldn't
  help. `Result` when the caller needs to tell failure modes apart (I/O, network). `panic!` for
  bugs and violated preconditions. Some codebases ban panics and use `Result` even for broken
  invariants. Developer-facing binaries and tests may panic. `#reporting-errors`

## Types

- Use a newtype, not a type alias, when the type has different semantics, needs its own API, may
  change its representation, or is easy to mix up with a sibling type (`Day` vs `Month`).
  `#newtypes-vs-type-aliases`
- Prefer named fields to tuples and multi-field tuple structs. Newtypes and very local tuples are
  fine. `#prefer-named-fields`

## Traits → [references/traits.md](references/traits.md)

- Low-level library code adds trait impls its users will need. Application code adds them only when
  needed. `#traits-yagni`
- If a method matches a standard trait, implement the trait: `impl FromStr`, not an inherent
  `fn from_str`. Keeping both is fine for discoverability. Clippy: `should_implement_trait`.
  `#known-traits`
- Use `#[derive(..)]` instead of a manual impl that a derive could produce. `#derive`
- In libraries, take generics (`T: Trait` / `impl Trait`) rather than `dyn Trait` parameters,
  unless code size matters. `#generics-vs-dyn-trait`
- Define a trait only for generic bounds, for `impl Trait`/`dyn Trait` in signatures, or as an
  extension trait. Otherwise use an inherent `impl`. Never use a trait just to group code.
  `#trait-vs-inherent-impl`
- Extension traits (adding methods to a foreign type, not meant for bounds or `dyn`) are named
  `FooExt`, and the team that owns `Foo` should own the trait. Exception: foundational extension
  methods expected to become well known. Input traits implemented on many foreign types
  (`DateLike`) are not extension traits. `#extension-traits`, `#naming-extension-traits`
- Standard trait expectations: types with public fields implement what all their fields implement.
  Error types should be `Copy` when they can be (not if they hold a `String`). Use `Copy` when it
  will clearly stay `Copy`. Most types implement `Clone` unless they own an external resource.
  `Default` goes with `new()` or any default state (Clippy: `new_without_default`). For `==`/`<`
  prefer `PartialEq`/`PartialOrd`. `Eq`/`Ord` add reflexivity/total-order obligations. Likely
  map keys get `Hash + Eq` (plus `Ord` if totally ordered). `#important-traits`
- A primary `From` impl comes with an inherent constructor (`new()`, `from_foo()`). `#from-impls`
- An all-public-fields "bag of options" struct implements `Default`, so callers can write
  `Opts { a: 1, ..Default::default() }`. `#options-should-implement-default`

## Concurrency

- Never reach into a poisoned mutex (`PoisonError::into_inner`, `get_ref`, ...), however tempting.
  `#poison`

## Macros

- Prefer, in order: plain functions/types/traits/modules, `macro_rules!`, other code generation
  (e.g. genrules), and last `proc_macro`. A macro costs IDE and code-search support, creates local
  dialects, and makes large-scale changes harder. Justify it against those costs. `#macros`

## Naming and documentation → [references/naming-and-docs.md](references/naming-and-docs.md)

- Method names follow std conventions, including `as_` / `to_` / `into_` with the matching `self`
  form (Clippy: `wrong_self_convention`). `#naming-methods`
- Lifetimes get descriptive names, especially on types. `'_` is fine wherever it works. Single
  letters are fine for a method's input→output relationship or a local `for<'a>`, at most two.
  Very generic abstractions (`Cow<'a>`) are exempt. `#lifetimes`
- Generic parameters get short names that hint at their main bound. `T`/`U` are for nearly
  unbounded APIs like `Vec<T>`. `#generic-parameters`
- Constructors are `new()`, with `new_with_foo()` for alternatives. A constructor returning
  `Result` is `try_new()`. Value-to-value conversions are `from_foo()` plus a `From` impl.
  `#naming-initialization-functions`
- Getters and setters: `foo()` returns `&T` (or `T` if `Copy`), `foo_mut()` returns `&mut T`,
  `take_foo()` clears and returns the old value, `set_foo(T)` sets, `replace_foo(T)` sets and
  returns the old value, and `with_foo(|f| ..)` / `with_mut_foo` take a closure. So the getter is
  `foo()`, not `get_foo()`. `#getters-and-setters`
- No abbreviations outsiders wouldn't know, and no abbreviating by dropping letters inside a word
  (`cnt` for count). Abbreviations common enough for Wikipedia, or clear outside the project (`IpAddr`),
  are fine. `#avoid-abbreviations`
- Doc-comment public APIs (the `missing_docs` lint helps). Show examples somewhere in the crate.
  Always document panics on malformed input and the invariants of `unsafe` fns and traits. Use
  capitalization and punctuation. Don't explain the language, and drop comments that only repeat
  the name (`/// Removes an element.` on `remove_element`). Self-explanatory enum variants may go
  undocumented. `#writing-doc`
- `///` documents the next item, `//!` documents the module or crate at the top of the file, `//` is
  for everything else (implementation notes, TODOs, commented-out code). Mixing `///` and `//`
  on one item is encouraged. Use Markdown. Write docs directly, not generated from macros.
  `#writing-doc`

## Other language features

- Write `unsafe` only when safe code can't do it. Wrap it in a small safe abstraction, ideally its
  own crate, away from business logic. Every unsafe block needs a `// SAFETY:` comment saying why
  it's sound, plus a justification (why not safe? if for performance, where are the benchmarks?).
  `#unsafe`
- No unstable features. Per-codebase exceptions are listed in the last section.
  `#unstable-features`
- Implement expected API sets together: `len()` comes with `is_empty()` (Clippy:
  `len_without_is_empty`). `#expected-api-sets`
- Treat `#[doc(hidden)]` items you don't own as private. `#doc-hidden`
- Make a public fn `const` only if it will stay `const`. Dropping `const` later breaks callers.
  `#const-functions`
- Overload operators only for their mathematical or logical meaning, never as syntax sugar.
  `#operator-overloads`
- Mark public enums used by other teams `#[non_exhaustive]`. Exceptions: enums that will never
  change (a fixed ontology like `Color { Red, Green, Blue }`, or a two-state enum that could be a
  `bool`), or ones whose owners will fix breakages via a large-scale change. Clippy:
  `exhaustive_enums`. `#non-exhaustive-enums`
- Mark public structs with public fields used by other teams `#[non_exhaustive]`. Exceptions:
  stable fields (`Rectangle`), owners committed to fixing breakages via a large-scale change, or
  when you want callers to use `..Default::default()` struct update syntax. `#non-exhaustive-structs`
- `#[must_use]` on functions whose result can't be ignored safely: pure functions like
  `HashMap::get`, and results that carry errors or critical information, unless the return type
  is already `#[must_use]`, like `Result`. Put it on types too: error types and lazy computations.
  `#must-use-on-functions`, `#must-use-on-types`
- No code before `main()` (`ctor` crate and the like). `#global-initialization`

## Implementation → [references/implementation.md](references/implementation.md)

- Add enough explicit types that a reader can tell what was inferred. Annotate the `let`, not a
  turbofish. `::<_>` is fine when the compiler forces a turbofish. Annotate especially after
  `.into()`, `.parse()`, and long iterator chains. `#type-inference`
- When the data guarantees success, prove it with a pattern instead of checking then unwrapping:
  `if let Some(v) = opt`, not `if opt.is_some() { opt.unwrap() }`. `#dont-check-then-unwrap`
- When a panic is necessary because the type system can't express the invariant, use
  `expect("why this holds")`, not `unwrap()`. `#expect-over-unwrap`
- Matching a `#[non_exhaustive]` enum: list every variant you know, and put the ones you don't care
  about in the wildcard arm (`Shape::Triangle | _ => {}`). If you only care about some, use
  `if let` or `let ... else`. A bare `_` that hides known variants is wrong, unless `match` is
  clearly cleaner than `if let`. `#non-exhaustive-enum-matching`
- Give `assert!` a message that says why the condition should hold, logs the offending value, or
  says whether failure means API misuse or a bug. A message that restates the condition is worse
  than none. Prefer a message to a comment, because the message shows up in logs.
  `#assertion-context`
- Combinator chains: keep them short. Never build one in a `for` header; bind it to a named
  variable first. Avoid `Iterator::for_each` and use a `for` loop. Do use combinators when they
  replace hand-written logic (`.any(..)` instead of a flag-and-break loop). `#combinator-chains`
- No `panic::catch_unwind` in first-party code. The only exception is defense in depth that is
  never relied on, in `panic=unwind` builds of codebases that already work hard to avoid panics.
  Chrome, Android and Fuchsia build with `panic=abort`. `#catch-unwind`
- Use `format!`/`write!` to join more than two strings (`format!("{a}{b}{c}")`, not `a + b + c`)
  and to fill in a literal template (not `str::replace`). `#prefer-format-or-write`

## Codebase-specific rules (only inside that codebase)

- **Chromium:** prefer small crates, ideally one file per abstraction. Keep one crate's `.rs` files
  in one flat directory with no subdirectories (except Cargo-built `//third_party`). Import with
  `chromium::import!()`. No `async`/`.await`. Use sequences, not `std::thread`. Style arbiters may
  blanket-approve some unstable features. Tests use `rust_gtest_interop`. `#small-crates`,
  `#structure`, `#import-macro`, `#async-await-chrome`, `#std-thread`, `#test-framework`
- **Android:** embedded code may use unstable features that are required to build, after review.
  `#unstable-features`
- **Fuchsia:** use `fuchsia_sync::Mutex`, not `std::sync`/`parking_lot`. Tests use
  `#[fuchsia::test]`. Follow Fuchsia's own unstable-feature policy. `#fuchsia-mutex`,
  `#test-framework`
- **Any codebase:** use that codebase's test framework when it has one, rather than bare
  `#[test]`. `#test-framework`

## Keeping current

The guide was first published on 2026-10-21 and is still changing. To see whether this copy is
behind, run:

```bash
gh api 'repos/google/styleguide/commits?sha=gh-pages&path=rustguide.md&per_page=1' --jq '.[0].sha[0:8]'
```

If the result isn't `c775c0c2`, diff the upstream file before relying on a rule that looks
surprising.

## Attribution

Adapted from the [Google Rust Style Guide](https://google.github.io/styleguide/rustguide.html),
© Google, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). This version
condenses and reorders the rules, and paraphrases or shortens their text and examples.
