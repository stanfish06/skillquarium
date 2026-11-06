# Function inputs and outputs: examples

From Google's Rust Style Guide, condensed (CC BY 3.0). The binding rules are in `../SKILL.md`.

## Flexible references `#flexible-references`

| Take         | Instead of   | Why                                       |
| ------------ | ------------ | ----------------------------------------- |
| `&T`         | `&Box<T>`    | borrow the data inside the box            |
| `&[T]`       | `&Vec<T>`    | any contiguous slice works                |
| `&str`       | `&String`    | literals and slices work without allocating |
| `Option<&T>` | `&Option<T>` | borrow the data inside the option         |

```rust
// Bad: callers holding a &str or an array must allocate first.
pub fn lookup(users: &Vec<User>, email: &String) -> Option<&User>

// Good
pub fn lookup<'users>(users: &'users [User], email: &str) -> Option<&'users User>
```

Exception: non-contiguous text (ropes, cords).

## Iterators in signatures `#return-iterators` `#accept-iterators`

```rust
// Library: let the caller decide whether to collect.
pub fn overdue(&self) -> impl Iterator<Item = &Invoice> + '_ {
    self.invoices.iter().filter(|invoice| invoice.is_overdue())
}

// Library input that is only iterated:
pub fn total<I: IntoIterator<Item = u64>>(amounts: I) -> u64 {
    amounts.into_iter().sum()
}
```

Return a `Vec` when most callers would collect anyway, the function builds one naturally, the result
is indexed randomly, a `for` loop is clearer and the allocation doesn't matter, the function's purpose
is to build a collection, or the vector already exists. In application code, take `&[T]` or return a
`Vec` whenever that's simpler.

## `impl Into<T>` `#accepting-into`

Use it only in library APIs where callers usually hold a different type and call-site ergonomics
really matter (`impl Into<String>` accepts `&str` and `String`). Each use costs a generic signature,
more code, and sometimes worse inference. Application code should almost never use it.

## `enum` over `bool` `#enum-vs-bool`

```rust
// Bad: what does `true` mean at the call site?
client.connect(addr, true);

// Good
pub enum Retry { OnFailure, Never }
client.connect(addr, Retry::OnFailure);

// Keeping the bool: label it.
client.connect(addr, /* retry= */ true);
```

## Reporting errors `#reporting-errors`

```rust
// Option: the cause is obvious and there is nothing more to say.
fn checked_add(a: u32, b: u32) -> Option<u32>

// Result: the caller needs to tell NotFound from PermissionDenied.
fn open_file(path: &Path) -> Result<File, io::Error>

// panic!: the caller broke a precondition, which is a bug to fix rather than handle.
pub fn remove(&mut self, index: usize) -> T {
    if index >= self.len() {
        panic!("index {index} out of bounds for length {}", self.len());
    }
    // ...
}
```

Some codebases forbid panics and report broken invariants with `Result` too. Developer-facing binaries
may panic for non-fatal errors, and tests may panic for assertions.
