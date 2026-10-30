# Traits: examples

From Google's Rust Style Guide, condensed (CC BY 3.0). The binding rules are in `../SKILL.md`.

## Standard traits instead of custom methods `#known-traits`

```rust
// Bad
impl Foo {
    pub fn from_str(s: &str) -> Foo { ... }
}

// Good
impl FromStr for Foo {
    type Err = ParseFooError;
    fn from_str(s: &str) -> Result<Foo, ParseFooError> { ... }
}
```

Keeping an inherent method next to the trait impl is acceptable for discoverability.

## Derive instead of hand-writing `#derive`

```rust
// Bad: this is exactly what the derive produces.
impl Clone for Point {
    fn clone(&self) -> Self { Point { x: self.x, y: self.y } }
}

// Good
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point { x: f64, y: f64 }
```

## Generics vs `dyn Trait` in library parameters `#generics-vs-dyn-trait`

```rust
// Prefer: static dispatch, inlinable, works with non-dyn-compatible traits.
pub fn log_to<L: Logger>(logger: &mut L, event: &Event)
pub fn log_to(logger: &mut impl Logger, event: &Event)

// Only when code size matters:
pub fn log_to(logger: &mut dyn Logger, event: &Event)
```

A `dyn` parameter uses vtable dispatch and can limit inlining. Methods with type parameters,
`self`-less associated functions, and methods returning `Self` prevent dyn compatibility unless each
has `where Self: Sized`. That bound excludes those methods from trait-object calls; other
dyn-compatibility requirements still apply. See the
[Rust Reference](https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility).

## Trait vs inherent impl `#trait-vs-inherent-impl`

Define a trait only for one of these:

- generic bounds (`T: Trait`),
- `impl Trait` / `dyn Trait` in a signature,
- an extension trait.

```rust
// Bad: one implementor, never used as a bound. The trait only groups methods.
trait ReportFormatting {
    fn render_header(&self) -> String;
}
impl ReportFormatting for Report { ... }

// Good
impl Report {
    fn render_header(&self) -> String { ... }
}
```

## Extension traits `#extension-traits`

An extension trait only adds methods to a type from another crate, and isn't used in bounds or `dyn`.
Name it `<Type>Ext`. The team that owns the type should own the trait.

```rust
use foreign_crate::ForeignType;

pub trait ForeignTypeExt {
    fn additional_method(&self);
}
impl ForeignTypeExt for ForeignType { ... }

// Blanket form: in effect a default method on a foreign trait.
pub trait ForeignTraitExt {
    fn additional_method(&self);
}
impl<T: ForeignTrait> ForeignTraitExt for T { ... }
```

Not an extension trait: an input trait such as `DateLike`, implemented on many foreign types so a
generic function can accept any of them.

## Expected trait impls `#important-traits`

| Situation | Implement |
| --- | --- |
| Type has public fields | Consider traits implemented by all the fields |
| Error type | `Copy` when possible (not when it holds a `String`) |
| Will clearly stay `Copy` | `Copy` |
| Almost every type | `Clone`, unless it represents an external resource |
| Has `new()` or a default state | `Default` (Clippy `new_without_default`) |
| Callers should use `==` / `<` | `PartialEq` / `PartialOrd` (`Eq`/`Ord` add reflexivity and total order) |
| Likely map key or cached | `Hash` + `Eq`, plus `Ord` if totally ordered |
| Important `From` impl | Also an inherent `new()` / `from_foo()` constructor `#from-impls` |
| All-public "options" struct | `Default`, for `Opts { a: 1, ..Default::default() }` `#options-should-implement-default` |
