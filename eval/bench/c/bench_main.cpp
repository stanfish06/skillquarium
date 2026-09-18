// Bench runner. bench.cpp provides bench_setup() and bench_run(). Allocations
// counted by replacing global operator new/delete.
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <new>

static std::uint64_t g_allocs = 0, g_bytes = 0;

static void *counted(std::size_t n) {
    g_allocs++;
    g_bytes += n;
    if (void *p = std::malloc(n ? n : 1)) return p;
    throw std::bad_alloc();
}
void *operator new(std::size_t n) { return counted(n); }
void *operator new[](std::size_t n) { return counted(n); }
void *operator new(std::size_t n, std::align_val_t a) {
    g_allocs++;
    g_bytes += n;
    std::size_t al = static_cast<std::size_t>(a);
    if (void *p = std::aligned_alloc(al, (n + al - 1) / al * al)) return p;
    throw std::bad_alloc();
}
void *operator new[](std::size_t n, std::align_val_t a) { return operator new(n, a); }
void operator delete(void *p) noexcept { std::free(p); }
void operator delete[](void *p) noexcept { std::free(p); }
void operator delete(void *p, std::size_t) noexcept { std::free(p); }
void operator delete[](void *p, std::size_t) noexcept { std::free(p); }
void operator delete(void *p, std::align_val_t) noexcept { std::free(p); }
void operator delete[](void *p, std::align_val_t) noexcept { std::free(p); }
void operator delete(void *p, std::size_t, std::align_val_t) noexcept { std::free(p); }
void operator delete[](void *p, std::size_t, std::align_val_t) noexcept { std::free(p); }

void bench_setup();
std::uint64_t bench_run();

static double now_ns() {
    using namespace std::chrono;
    return static_cast<double>(duration_cast<nanoseconds>(steady_clock::now().time_since_epoch()).count());
}

static volatile std::uint64_t sink;

int main() {
    bench_setup();
    sink += bench_run(); // warm-up

    // calibrate n to ~0.3 s
    std::uint64_t n = 1;
    for (;;) {
        double t = now_ns();
        for (std::uint64_t i = 0; i < n; i++) sink += bench_run();
        if (now_ns() - t >= 3e8 || n >= (1u << 24)) break;
        n *= 2;
    }

    g_allocs = 0;
    g_bytes = 0;
    double t = now_ns();
    for (std::uint64_t i = 0; i < n; i++) sink += bench_run();
    double el = now_ns() - t;
    std::printf("BENCH ns/op=%.3f B/op=%.3f allocs/op=%.3f\n", el / static_cast<double>(n),
                static_cast<double>(g_bytes) / static_cast<double>(n),
                static_cast<double>(g_allocs) / static_cast<double>(n));
    return 0;
}
