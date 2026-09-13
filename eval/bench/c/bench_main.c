/* Bench runner. bench.c provides bench_setup() and bench_run(). Allocations
 * counted via ld --wrap on malloc/calloc/realloc from the linked objects. */
#define _POSIX_C_SOURCE 200809L /* clock_gettime under -std=c17 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

extern void *__real_malloc(size_t n);
extern void *__real_calloc(size_t a, size_t b);
extern void *__real_realloc(void *p, size_t n);

static uint64_t g_allocs, g_bytes;

void *__wrap_malloc(size_t n) { g_allocs++; g_bytes += n; return __real_malloc(n); }
void *__wrap_calloc(size_t a, size_t b) { g_allocs++; g_bytes += a * b; return __real_calloc(a, b); }
void *__wrap_realloc(void *p, size_t n) { g_allocs++; g_bytes += n; return __real_realloc(p, n); }

void bench_setup(void);
uint64_t bench_run(void);

static double now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec * 1e9 + (double)ts.tv_nsec;
}

static volatile uint64_t sink;

int main(void) {
    bench_setup();
    sink += bench_run(); /* warm-up */

    /* calibrate n to ~0.3 s */
    uint64_t n = 1;
    for (;;) {
        double t = now_ns();
        for (uint64_t i = 0; i < n; i++) sink += bench_run();
        if (now_ns() - t >= 3e8 || n >= (1u << 24)) break;
        n *= 2;
    }

    g_allocs = 0;
    g_bytes = 0;
    double t = now_ns();
    for (uint64_t i = 0; i < n; i++) sink += bench_run();
    double el = now_ns() - t;
    printf("BENCH ns/op=%.3f B/op=%.3f allocs/op=%.3f\n", el / (double)n,
           (double)g_bytes / (double)n, (double)g_allocs / (double)n);
    return 0;
}
