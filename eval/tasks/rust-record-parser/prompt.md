Write a self-contained Rust library file `solution.rs` (standard library only,
edition 2024, no external crates) that parses a text of user records.

Each non-empty line of the input has three comma-separated fields:
`name,age,email`. Whitespace around a field is trimmed.

Export exactly this API. How you represent the fields internally is up to you;
the accessors are the only contract.

```rust
pub struct Record { /* your fields */ }
impl Record {
    pub fn name(&self) -> &str;
    pub fn age(&self) -> u8;
    pub fn email(&self) -> &str;
}

pub struct ParseError { /* your fields */ }
impl ParseError {
    /// 1-based line number of the offending line.
    pub fn line(&self) -> usize;
}

pub fn parse_records(input: &str) -> Result<Vec<Record>, ParseError>;
```

Behaviour:

1. A line is invalid when it does not have exactly three fields, when `name`
   is empty, when `age` is not an integer in `0..=150`, or when `email` does
   not contain exactly one `@` with non-empty text on both sides.
2. The first invalid line stops parsing and is reported through
   `ParseError::line`. Blank lines are skipped but still count toward line
   numbers.
3. `ParseError` must implement `std::fmt::Display`, `std::fmt::Debug` and
   `std::error::Error`.
4. Empty input returns an empty `Vec`.

Return only the contents of `solution.rs` in a single Rust code block.
