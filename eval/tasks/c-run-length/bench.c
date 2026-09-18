#include <stddef.h>
#include <stdint.h>

size_t rle_encode(const unsigned char *in, size_t n, unsigned char *out, size_t cap);
size_t rle_decode(const unsigned char *in, size_t n, unsigned char *out, size_t cap);

static unsigned char src[1 << 16], enc[1 << 17], dec[1 << 16];

void bench_setup(void) {
    unsigned x = 12345u;
    size_t i = 0;
    while (i < sizeof src) {
        x = x * 1103515245u + 12345u;
        size_t run = 1 + (x >> 16) % 40;
        unsigned char b = (unsigned char)(x >> 8);
        for (size_t k = 0; k < run && i < sizeof src; k++) src[i++] = b;
    }
}

uint64_t bench_run(void) {
    size_t n = rle_encode(src, sizeof src, enc, sizeof enc);
    size_t m = rle_decode(enc, n, dec, sizeof dec);
    return (uint64_t)n * 31u + (uint64_t)m + dec[sizeof dec - 1];
}
