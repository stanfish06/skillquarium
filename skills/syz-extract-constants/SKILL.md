---
name: syz-extract-constants
description: Defining and extracting kernel constants for syzkaller syzlang descriptions
---

# Defining Constants in Syzlang

Written against syzkaller commit `c1f5c7d0` (guidance reviewed 2026-11); if the tooling behaves differently, check `docs/syscall_descriptions.md` in your checkout. See also: `syzlang-ioctl-basics` for the description syntax.

## Overview

Syzkaller needs to know the actual values of kernel constants (ioctl numbers, flags, etc.) to generate valid fuzzing programs. There are two ways to provide these values:

1. **Manual `.const` file** - Define constants directly in a companion file (fallback only)
2. **`syz-extract` tool** - Extract values from kernel source headers for every arch (preferred; requires a kernel checkout)

Prefer `make extract` (Method 2): it computes per-arch values, which hand-written files often get wrong.

## Method 1: Manual Constants File (fallback when no kernel source)

Create a `.const` file alongside your `.txt` file with the constant values:

### File naming
- Syzlang description: `sys/linux/dev_mydev.txt`
- Constants file: `sys/linux/dev_mydev.txt.const`

### Constants file format

```
# Constants for your syzlang descriptions (example values from <linux/random.h>)
arches = 386, amd64, arm, arm64, mips64le, ppc64le, riscv64, s390x
RNDZAPENTCNT = 20996, mips64le:536891908, ppc64le:536891908
RNDGETENTCNT = 2147766784, mips64le:1074024960, ppc64le:1074024960
```

The `arches` line declares which architectures these constants are valid for. A line is `NAME = default, arch:value, ...`: the first value applies to every listed arch without an override (e.g. `NAME = v, 386:w` uses `w` on 386 and `v` elsewhere). Ioctl numbers are **not** architecture-independent: mips64le and ppc64le use a different direction encoding (so even `_IO` values change), and any ioctl whose argument size depends on `long`/pointer width differs between 32-bit (386, arm) and 64-bit arches.

### Calculating ioctl values

With the asm-generic encoding (x86, arm, arm64, riscv, s390), Linux ioctl numbers are:
- `_IO(type, nr)` = `(type << 8) | nr`
- `_IOR(type, nr, size)` = `(2 << 30) | (size << 16) | (type << 8) | nr`
- `_IOW(type, nr, size)` = `(1 << 30) | (size << 16) | (type << 8) | nr`
- `_IOWR(type, nr, size)` = `(3 << 30) | (size << 16) | (type << 8) | nr`

On mips, powerpc (and alpha, sparc) the direction field is 3 bits at bit 29 and size is 13 bits: `_IOC_NONE = 1`, `_IOC_READ = 2`, `_IOC_WRITE = 4`, so `_IO(type, nr)` = `(1 << 29) | (type << 8) | nr` and `_IOR(type, nr, size)` = `(2 << 29) | (size << 16) | (type << 8) | nr`.

Example for `<linux/random.h>` (type='R'=0x52):
- `RNDZAPENTCNT = _IO('R', 0x04)` = `0x5204` = `20996` (mips64le/ppc64le: `0x20005204` = `536891908`)
- `RNDGETENTCNT = _IOR('R', 0x00, int)` = `0x80045200` = `2147766784` (mips64le/ppc64le: `0x40045200` = `1074024960`)

## Method 2: Using syz-extract (preferred; requires kernel source)

If kernel source is available:

```bash
cd <syzkaller-checkout>

# Extract constants for a specific file (writes sys/linux/dev_mydev.txt.const)
make extract TARGETOS=linux SOURCEDIR=<linux-checkout> FILES=sys/linux/dev_mydev.txt
```

Without a kernel checkout, fall back to Method 1 and compute each value per arch as shown above.

## After Defining Constants

After creating the `.const` file, build syzkaller:

```bash
cd <syzkaller-checkout>
make descriptions  # Compiles descriptions + constants
make all           # Full build
```

## Common Errors

### "is defined for none of the arches"
```
RNDZAPENTCNT is defined for none of the arches
```

The constant is used in the `.txt` file but has no value in the `.const` file.

Solution: Run `make extract` with the correct kernel source path and FILES parameter. With a hand-written `.const`, add the missing constant and make sure the `arches` line lists the target architectures.

### Missing headers
```
cannot find include file: uapi/linux/<header>.h
```

Solution: Check the kernel source path and ensure headers are properly configured.

### "unknown file"
```
unknown file: sys/linux/dev_mydev.txt
```

Solution: Use `make extract FILES=...` instead of calling `bin/syz-extract` directly.

## Example Workflow

1. Write the syzlang description file (`sys/linux/dev_mydev.txt`)
2. Run `make extract TARGETOS=linux SOURCEDIR=<linux-checkout> FILES=sys/linux/dev_mydev.txt`
3. Run `make generate` to regenerate Go code
4. Run `make` to build syzkaller
5. Test with `make descriptions` to verify everything compiles
