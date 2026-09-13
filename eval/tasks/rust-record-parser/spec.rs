use solution::*;

#[test]
fn parses_valid_records() {
    let recs = parse_records("Ann, 34, ann@example.com\n\nBob,7,bob@x.io\n").expect("valid input");
    assert_eq!(recs.len(), 2);
    assert_eq!(recs[0].name(), "Ann");
    assert_eq!(recs[0].age(), 34);
    assert_eq!(recs[0].email(), "ann@example.com");
    assert_eq!(recs[1].name(), "Bob");
    assert_eq!(recs[1].age(), 7);
}

#[test]
fn empty_input_is_empty_vec() {
    assert!(parse_records("").expect("empty").is_empty());
    assert!(parse_records("\n\n").expect("blank lines").is_empty());
}

#[test]
fn reports_line_of_first_error_counting_blanks() {
    let err = parse_records("Ann,34,ann@example.com\n\nBob,x,bob@x.io\nCy,1,bad\n").err().expect("bad age");
    assert_eq!(err.line(), 3);
    let shown = err.to_string();
    assert!(!shown.is_empty());
    let _as_error: &dyn std::error::Error = &err;
    let _debug = format!("{err:?}");
}

#[test]
fn rejects_each_rule() {
    for bad in ["A,1,noat", "A,1,a@@b", "A,1,@b", "A,1,a@", "A,151,a@b", "A,-1,a@b", "A,1.5,a@b", ",1,a@b", "A,1,a@b,extra", "A,1"] {
        let err = parse_records(bad).err().unwrap_or_else(|| panic!("accepted invalid line {bad:?}"));
        assert_eq!(err.line(), 1, "line number for {bad:?}");
    }
}
