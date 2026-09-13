// working set larger than the cache: hits and evictions every iteration
#include "solution.hpp"

#include <cstdint>
#include <vector>

static std::vector<int> keys;

void bench_setup() {
    keys.resize(4096);
    for (int i = 0; i < 4096; ++i) keys[static_cast<std::size_t>(i)] = (i * 7919) % 3000;
}

std::uint64_t bench_run() {
    LruCache<int, int> c(1024);
    std::uint64_t acc = 0;
    for (int k : keys) {
        if (auto v = c.get(k)) acc += static_cast<std::uint64_t>(*v);
        else c.put(k, k * 2);
    }
    return acc + c.size();
}
