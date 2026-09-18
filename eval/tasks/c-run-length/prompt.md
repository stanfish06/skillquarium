Write a self-contained C17 file `solution.c` (standard library only)
implementing run-length encoding of bytes. Declare the prototypes in the file
itself; there is no header.

```c
#include <stddef.h>
#include <stdint.h>

size_t rle_encode(const unsigned char *in, size_t n, unsigned char *out, size_t cap);
size_t rle_decode(const unsigned char *in, size_t n, unsigned char *out, size_t cap);
```

Format: each run of identical bytes becomes two bytes, the run length
(1..255) followed by the byte. A run longer than 255 is split into several.

Behaviour:

1. `rle_encode` writes at most `cap` bytes to `out` and returns the length of
   the complete encoding, even when it exceeds `cap`. It never writes past
   `out + cap`. `out` may be NULL when `cap` is 0.
2. `rle_decode` is the inverse with the same `cap` contract. It returns
   `SIZE_MAX` when the input is not a valid encoding: odd length, or a run
   length of 0.
3. `n == 0` returns 0 for both functions.
4. No global mutable state; the functions must be reentrant.

Return only the contents of `solution.c` in a single C code block.
