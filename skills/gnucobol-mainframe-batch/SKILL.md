---
name: gnucobol-mainframe-batch
description: >-
  GnuCOBOL toolchain pointers for mainframe-style batch programs
  (LINE/RECORD SEQUENTIAL files, PIC clauses, cobc build flags).
---

# GnuCOBOL mainframe batch

## Compile and run

```bash
cobc -x -free -o prog PROG.cbl
./prog
```

`-free` selects free-form source (no sequence area in columns 1-6 and no
indicator column 7). `*>` inline comments work in both formats; in fixed
format they can start anywhere from column 7 on. File names in `SELECT`
are resolved relative to the program's run directory. When porting z/OS
sources, `-std=ibm` enables IBM dialect syntax and `-fsign=EBCDIC` makes
signed `DISPLAY` fields use EBCDIC sign encoding.

```cobol
SELECT DETAIL-FILE ASSIGN TO "INPUT.DAT"
    ORGANIZATION IS SEQUENTIAL.
```

For 80-byte fixed-record tapes use `ORGANIZATION IS SEQUENTIAL` with
`RECORD CONTAINS 80 CHARACTERS` in the FD. Pad `WRITE` records to the
required length (e.g. `MOVE SPACES TO OUT-REC` before populating fields).

`ORGANIZATION IS LINE SEQUENTIAL` reads and writes newline-terminated text
lines. On `READ`, a short line is padded with spaces to the record length;
on `WRITE`, trailing spaces are dropped by default (set `COB_LS_FIXED=TRUE`
at runtime to keep full-length lines). Use it for text files written by
editors or scripts. `ORGANIZATION IS SEQUENTIAL` (record sequential) stores
fixed-length records back to back with no delimiter, so a file with
newlines between records reads out of alignment unless the record length
counts the newline byte. Use record sequential for records holding binary
or `COMP-3` fields, which can contain newline bytes.

## PIC and signed amounts

When a tape stores sign and magnitude in separate positions (`PIC X` plus
`PIC 9(11)V99`), build a signed working-storage value before `ADD` /
`SUBTRACT`. Using only the unsigned magnitude in `EVALUATE` branches is a
frequent bug when debits and credits share the same magnitude field.

`COMPUTE … ROUNDED` rounds half away from zero in GnuCOBOL (matches the
Python `Decimal` `ROUND_HALF_UP` behaviour). Use it when multiplying a
two-decimal amount by a four-decimal rate and storing into a two-decimal
field.

## Debug loop

1. `cobc -x -free -Wall -o prog PROG.cbl`
2. `DISPLAY` intermediate values for one or two records to confirm the
   posting math and any cross-file lookups.
3. Reconcile against a short script that applies the program's specification
   to the same record layout.

## References

- [GnuCOBOL programmer's guide](https://gnucobol.sourceforge.io/doc/gnucobol.html)
- IBM Enterprise COBOL language reference for PIC/USAGE and file control
  when porting z/OS sources
