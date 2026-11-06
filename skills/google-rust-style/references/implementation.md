# Implementation: examples

From Google's Rust Style Guide, condensed (CC BY 3.0). The binding rules are in `../SKILL.md`.

## Type inference `#type-inference`

```rust
// Bad: the reader has to work out what `port` is.
let port = args.port.parse()?;

// Good: annotate the binding rather than adding a turbofish.
let port: u16 = args.port.parse()?;
let names: Vec<_> = items.iter().map(Item::name).collect();   // `_` is fine inside
```

## Check-then-unwrap `#dont-check-then-unwrap`

```rust
// Bad: correctness of unwrap depends on a runtime check.
if option.is_some() {
    use_value(option.unwrap());
}

// Good: the pattern proves it.
if let Some(value) = option {
    use_value(value);
}
```

## `expect` over `unwrap` `#expect-over-unwrap`

```rust
// Bad
let first = words.first().unwrap();

// Good: say why it can't fail.
let first = words.first().expect("split_whitespace on a non-blank line yields a word");
```

## Matching `#[non_exhaustive]` enums `#non-exhaustive-enum-matching`

The rule is about matching an enum defined in another crate. Inside the defining crate,
`#[non_exhaustive]` has no effect, so the `_` arm below would be unreachable there.

```rust
// Defined in another crate as:
//     #[non_exhaustive]
//     pub enum Shape { Circle, Square, Triangle }
use shapes::Shape;

// Good: explicitly documents which known variants need no action.
match shape {
    Shape::Circle => draw_circle(),
    Shape::Square => draw_square(),
    // Triangle and future variants need nothing.
    Shape::Triangle | _ => {}
}

// Good: only one variant matters.
if let Shape::Circle = shape { draw_circle(); }

// Bad: `_` hides the known Square and Triangle.
match shape {
    Shape::Circle => draw_circle(),
    _ => {}
}
```

Listing known variants documents intent for reviewers. The wildcard still accepts future variants;
this does not make upstream additions produce a compiler diagnostic.

## Assertion messages `#assertion-context`

```rust
// Good: why it should hold
assert!(values.is_sorted(), "`values` comes from a PriorityQueue, so it is sorted");
// Good: log the value
assert!(refund > 0, "refund must be positive, got {refund:?}");
// Good: says it's API misuse, not a bug
assert!(self.stream.is_some(), "call connect() before executing queries");

// Bad: restates the condition
assert!(values.is_sorted(), "values should always be sorted");
```

## Combinator chains `#combinator-chains`

```rust
// Bad: chain in the for header.
for bug in descriptions.iter().filter_map(|d| parse(d).ok()).filter(|b| b.priority <= P1) {
    assign(bug);
}

// Good: name the chain.
let urgent_bugs = descriptions.iter().filter_map(|d| parse(d).ok()).filter(|b| b.priority <= P1);
for bug in urgent_bugs {
    assign(bug);
}

// Bad: for_each, and chains that mutate outside state.
paths.iter().for_each(|path| watcher.add(path));

// Good: the combinator replaces a flag-and-break loop.
let exceeded = values.iter().any(|&v| v > threshold);
```

## String building `#prefer-format-or-write`

```rust
// Bad: three or more `+`, or a home-made template.
let full = first.to_string() + " " + middle + " " + last;
let greeting = "Hello, {name}!".replace("{name}", name);

// Good
let full = format!("{first} {middle} {last}");
let greeting = format!("Hello, {name}!");
```

## Unsafe `#unsafe`

```rust
/// Fixed-size record header. Every bit pattern is a valid `Header`, and it owns nothing.
#[derive(Clone, Copy)]
#[repr(C)]
pub struct Header {
    pub magic: u32,
    pub len: u32,
}

/// Reads the header that `buf` points to.
///
/// # Safety
///
/// `buf` must be non-null, aligned for `Header`, and valid for reads of
/// `size_of::<Header>()` initialized bytes.
pub unsafe fn read_header(buf: *const Header) -> Header {
    // SAFETY: the caller guarantees `buf` is non-null, aligned, and points to initialized bytes.
    // Any bit pattern is a valid `Header` (two `u32`s), and `Header: Copy`, so the copy
    // creates no second owner.
    unsafe { ptr::read(buf) }
}
```

The `# Safety` doc section states the contract for callers. The `// SAFETY:` comment explains why
this block meets it. Every unsafe block needs one. The contract has to cover everything the unsafe
operation requires. For `ptr::read`, that is a properly initialized, valid value of the type, plus
ownership: reading a non-`Copy` value makes a second owner, so the caller must give up the source.
"Initialized bytes" is enough only when every bit pattern is a valid value, as it is here.

## Poisoned mutexes `#poison`

```rust
// Bad: uses data that a panicking thread left half-updated.
let counts = match self.counts.lock() {
    Ok(guard) => guard,
    Err(err) => err.into_inner(),
};

// Good: treat poisoning as the bug it is.
let counts = self.counts.lock().expect("a writer panicked while holding counts");
```
