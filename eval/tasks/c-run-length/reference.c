/* Reference solution for `selftest`. */
#include <stddef.h>
#include <stdint.h>

size_t rle_encode(const unsigned char *in, size_t n, unsigned char *out, size_t cap);
size_t rle_decode(const unsigned char *in, size_t n, unsigned char *out, size_t cap);

static void put(unsigned char *out, size_t cap, size_t pos, unsigned char b) {
    if (pos < cap) out[pos] = b;
}

size_t rle_encode(const unsigned char *in, size_t n, unsigned char *out, size_t cap) {
    size_t w = 0, i = 0;
    while (i < n) {
        unsigned char b = in[i];
        size_t run = 1;
        while (i + run < n && in[i + run] == b && run < 255) run++;
        put(out, cap, w++, (unsigned char)run);
        put(out, cap, w++, b);
        i += run;
    }
    return w;
}

size_t rle_decode(const unsigned char *in, size_t n, unsigned char *out, size_t cap) {
    if (n % 2 != 0) return SIZE_MAX;
    size_t w = 0;
    for (size_t i = 0; i < n; i += 2) {
        unsigned char cnt = in[i], b = in[i + 1];
        if (cnt == 0) return SIZE_MAX;
        for (unsigned k = 0; k < cnt; k++) put(out, cap, w++, b);
    }
    return w;
}
