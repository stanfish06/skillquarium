---
name: syzlang-ioctl-basics
description: Syzkaller syzlang syntax basics for describing ioctl syscalls
---

# Syzlang Ioctl Basics

Syzkaller's description language (syzlang) describes syscalls for fuzzing.
Description files are located at `<syzkaller-checkout>/sys/linux/*.txt`.
Full reference: [docs/syscall_descriptions_syntax.md](https://github.com/google/syzkaller/blob/master/docs/syscall_descriptions_syntax.md). See also: `syz-extract-constants` for the `.const` values these descriptions need.

## Syscall Syntax

Basic form:
```
syscall_name(arg1 type1, arg2 type2, ...) return_type
```

Specialized syscalls use `$` suffix:
```
syscall$VARIANT(args...) return_type
```

## Common Type Patterns

| Pattern | Meaning |
|---------|---------|
| `const[VALUE]` | Fixed constant value |
| `flags[flag_set, type]` | Bitfield from flag set |
| `ptr[direction, type]` | Pointer to `type`; direction `in` (user to kernel), `out` (kernel to user) or `inout` (both) |
| `intptr[min:max]` | Pointer-sized integer (32-bit on 386/arm, 64-bit elsewhere) limited to a range; not a pointer |
| `int8`, `int16`, `int32` | Fixed-size integers |
| `int16be`, `int32be` | Big-endian integers |
| `array[type]` | Variable-length array |
| `array[type, count]` | Fixed-length array |
| `len[field, type]` | Number of elements in `field` (bytes for a byte buffer) |
| `bytesize[field, type]` | Size of `field` in bytes |
| `string["literal"]` | Fixed string, e.g. a device path |

## Ioctl Patterns

For ioctls with output:
```
ioctl$CMD(fd fd_type, cmd const[CMD], arg ptr[out, int32])
```

For ioctls with input:
```
ioctl$CMD(fd fd_type, cmd const[CMD], arg ptr[in, struct_type])
```

For ioctls that read and write the argument (`_IOWR`):
```
ioctl$CMD(fd fd_type, cmd const[CMD], arg ptr[inout, struct_type])
```

For simple value ioctls:
```
ioctl$CMD(fd fd_type, cmd const[CMD], arg intptr[0:1])
```

For ioctls using ifreq structure (from socket.txt):
```
ioctl$CMD(fd fd_type, cmd const[CMD], arg ptr[in, ifreq_t[flags[flag_set, int16]]])
```

## Struct Definitions

Structs must have typed fields:
```
struct_name {
    field1    type1
    field2    type2
}
```

## Flag Sets

Define reusable flag sets:
```
flag_set_name = FLAG1, FLAG2, FLAG3
```

Then use with `flags[flag_set_name, int16]`.

## Resources

File descriptor resources:
```
resource fd_mydev[fd]
```

Create the resource with an opener. Fixed device path:
```
openat$mydev(fd const[AT_FDCWD], file ptr[in, string["/dev/mydev"]], flags flags[open_flags], mode const[0]) fd_mydev
```

Numbered device nodes (`#` is replaced by the `id` argument):
```
syz_open_dev$mydev(dev ptr[in, string["/dev/mydev#"]], id intptr, flags flags[open_flags]) fd_mydev
```

## Read/Write Syscalls

For specialized read/write:
```
read$suffix(fd fd_type, buf ptr[out, buffer_type], count len[buf])
write$suffix(fd fd_type, buf ptr[in, buffer_type], count len[buf])
```

## Tips

1. Check existing files for patterns (e.g., `sys/linux/socket.txt`)
2. Run `make descriptions` after edits to validate syntax
3. Some constants only exist on certain architectures
4. Use `ptr[in, ...]` for input, `ptr[out, ...]` for output
