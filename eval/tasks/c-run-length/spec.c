/* exact-size heap buffers: ASan catches any write past cap */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t rle_encode(const unsigned char *in, size_t n, unsigned char *out, size_t cap);
size_t rle_decode(const unsigned char *in, size_t n, unsigned char *out, size_t cap);

#define CHECK(c)                                                              \
    do {                                                                      \
        if (!(c)) {                                                           \
            fprintf(stderr, "CHECK failed: %s (line %d)\n", #c, __LINE__);    \
            exit(1);                                                          \
        }                                                                     \
    } while (0)

int main(void) {
    const unsigned char a[10] = {'a', 'a', 'a', 'b', 'c', 'c', 'd', 'd', 'd', 'd'};
    unsigned char out[64], back[64];

    const unsigned char want[8] = {3, 'a', 1, 'b', 2, 'c', 4, 'd'};
    size_t n = rle_encode(a, 10, out, sizeof out);
    CHECK(n == 8);
    CHECK(memcmp(out, want, 8) == 0);
    size_t m = rle_decode(out, n, back, sizeof back);
    CHECK(m == 10);
    CHECK(memcmp(back, a, 10) == 0);

    CHECK(rle_encode(a, 0, out, sizeof out) == 0);
    CHECK(rle_decode(out, 0, back, sizeof back) == 0);
    CHECK(rle_encode(a, 10, NULL, 0) == 8);
    CHECK(rle_decode(out, 8, NULL, 0) == 10);

    /* cap-limited: full length returned, exactly cap bytes written */
    unsigned char *tiny = malloc(3);
    CHECK(tiny != NULL);
    CHECK(rle_encode(a, 10, tiny, 3) == 8);
    CHECK(tiny[0] == 3 && tiny[1] == 'a' && tiny[2] == 1);
    free(tiny);
    unsigned char *tiny2 = malloc(4);
    CHECK(tiny2 != NULL);
    CHECK(rle_decode(out, 8, tiny2, 4) == 10);
    CHECK(memcmp(tiny2, "aaab", 4) == 0);
    free(tiny2);

    /* runs longer than 255 split */
    unsigned char big[300];
    memset(big, 'z', sizeof big);
    unsigned char enc[8];
    CHECK(rle_encode(big, 300, enc, sizeof enc) == 4);
    CHECK(enc[0] == 255 && enc[1] == 'z' && enc[2] == 45 && enc[3] == 'z');
    unsigned char dec[300];
    CHECK(rle_decode(enc, 4, dec, sizeof dec) == 300);
    CHECK(memcmp(dec, big, 300) == 0);

    /* invalid encodings */
    CHECK(rle_decode(enc, 3, back, sizeof back) == SIZE_MAX);
    const unsigned char zero[2] = {0, 'q'};
    CHECK(rle_decode(zero, 2, back, sizeof back) == SIZE_MAX);

    /* alternating bytes: worst case doubles the size */
    unsigned char alt[6] = {1, 2, 1, 2, 1, 2};
    CHECK(rle_encode(alt, 6, out, sizeof out) == 12);
    CHECK(rle_decode(out, 12, back, sizeof back) == 6);
    CHECK(memcmp(back, alt, 6) == 0);

    puts("spec ok");
    return 0;
}
