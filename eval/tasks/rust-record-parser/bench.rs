use solution::parse_records;

pub struct Input(String);

pub fn setup() -> Input {
    let mut s = String::new();
    for i in 0..5000 {
        s.push_str(&format!("user{i}, {}, user{i}@example.com\n", i % 120));
    }
    Input(s)
}

pub fn run(input: &Input) -> u64 {
    let recs = parse_records(&input.0).expect("bench input is valid");
    recs.iter().map(|r| r.age() as u64 + r.name().len() as u64).sum()
}
