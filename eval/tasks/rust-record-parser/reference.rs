// Reference solution for `selftest`; baseline shape, not skill-styled.
use std::error::Error;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Record {
    name: String,
    age: u8,
    email: String,
}

impl Record {
    pub fn name(&self) -> &str { &self.name }
    pub fn age(&self) -> u8 { self.age }
    pub fn email(&self) -> &str { &self.email }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseError {
    line: usize,
    reason: String,
}

impl ParseError {
    pub fn line(&self) -> usize { self.line }
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "line {}: {}", self.line, self.reason)
    }
}

impl Error for ParseError {}

pub fn parse_records(input: &str) -> Result<Vec<Record>, ParseError> {
    let mut out = Vec::new();
    for (idx, raw) in input.lines().enumerate() {
        let line = idx + 1;
        if raw.trim().is_empty() {
            continue;
        }
        let fail = |reason: &str| ParseError { line, reason: reason.to_string() };
        let fields: Vec<&str> = raw.split(',').map(str::trim).collect();
        if fields.len() != 3 {
            return Err(fail("expected 3 fields"));
        }
        let name = fields[0];
        if name.is_empty() {
            return Err(fail("empty name"));
        }
        let age = match fields[1].parse::<i64>() {
            Ok(v) if (0..=150).contains(&v) => v as u8,
            _ => return Err(fail("age out of range")),
        };
        let email = fields[2];
        let mut parts = email.split('@');
        match (parts.next(), parts.next(), parts.next()) {
            (Some(a), Some(b), None) if !a.is_empty() && !b.is_empty() => {}
            _ => return Err(fail("bad email")),
        }
        out.push(Record { name: name.to_string(), age, email: email.to_string() });
    }
    Ok(out)
}
