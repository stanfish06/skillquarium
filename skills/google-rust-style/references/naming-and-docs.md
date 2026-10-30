# Naming and documentation: examples

From Google's Rust Style Guide, condensed (CC BY 3.0). The binding rules are in `../SKILL.md`.

## Getters and setters `#getters-and-setters`

```rust
impl Stuff {
    fn foo(&self) -> &Foo { ... }                 // getter: &T, or T if Copy
    fn foo_mut(&mut self) -> &mut Foo { ... }     // mutable getter

    /// Sets "baz" to `None` and returns the old value.
    fn take_baz(&mut self) -> Option<Baz> { ... }

    fn set_foo(&mut self, foo: Foo) { ... }       // setter, takes T by value

    /// Sets "foo" to `foo` and returns the old value.
    fn replace_foo(&mut self, foo: Foo) -> Foo { ... }

    /// Calls `f` with a borrow of "bar" and returns what `f` returns.
    fn with_bar<R>(&self, f: impl FnOnce(&Bar) -> R) -> R { ... }
    fn with_mut_bar<R>(&self, f: impl FnOnce(&mut Bar) -> R) -> R { ... }
}
```

A closure accessor (`with_foo`) fits when the field sits behind `Mutex`/`RefCell`, so you don't leak
a `MutexGuard`, or when a change needs follow-up validation that `set_foo` can't provide because the
value is expensive or impossible to clone.

## Constructors `#naming-initialization-functions`

```rust
impl Connection {
    pub fn new(addr: SocketAddr) -> Connection { ... }
    pub fn new_with_timeout(addr: SocketAddr, timeout: Duration) -> Connection { ... }
    pub fn try_new(url: &str) -> Result<Connection, ConnectError> { ... }  // fallible: try_new
}
impl Celsius {
    pub fn from_fahrenheit(f: Fahrenheit) -> Celsius { ... }   // plus impl From<Fahrenheit>
}
```

## Lifetimes and generics `#lifetimes` `#generic-parameters`

```rust
// Bad: type lifetimes with no meaning.
pub struct Diff<'a, 'b> { old: &'a str, new: &'b str }

// Good
pub struct Diff<'old, 'new> { old: &'old str, new: &'new str }

// Fine: a single letter tying input to output in one method.
fn first_word<'a>(s: &'a str) -> &'a str

// Generic names hint at the bound; T/U only for nearly unbounded APIs.
fn render<W: io::Write>(out: &mut W)
```

## Abbreviations `#avoid-abbreviations`

Bad: `cfg_ldr`, `usr_cnt`, `txn_q`. Fine: `IpAddr`, `Url`, `Http`, `Id`, and anything common
enough to appear in Wikipedia. When unsure, spell it out.

## Doc comments `#writing-doc`

```rust
//! Parsing and validation for deployment config files.   <- module/crate docs, top of file

/// Finds the first `FooItem` with the given `name`, or `None` if not present.
// TODO: crbug.com/12345 - `name` should be &str.   <- implementation note, not shown in docs
pub fn get_named(items: &[FooItem], name: String) -> Option<&FooItem> { ... }
```

Don't:

```rust
/// Removes an element.                         <- repeats the name; omit it
pub fn remove_element() -> Element { ... }

/// A mock implementation of the FileSystem trait, intended to be used in unit tests.
impl FileSystem for MockFileSystem              <- explains the language
```

Do: document every panic on malformed input (`# Panics`) and every invariant of an `unsafe` fn or
trait (`# Safety`). Give enough examples across the crate to show how it's used. Use Markdown, full
sentences, and normal capitalization.
