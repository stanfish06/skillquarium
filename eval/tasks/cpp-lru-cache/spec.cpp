#include "solution.hpp"

#include <cstdio>
#include <cstdlib>
#include <string>

#define CHECK(c)                                                                    \
    do {                                                                            \
        if (!(c)) {                                                                 \
            std::fprintf(stderr, "CHECK failed: %s (line %d)\n", #c, __LINE__);     \
            std::exit(1);                                                           \
        }                                                                           \
    } while (0)

int main() {
    LruCache<int, std::string> c(2);
    CHECK(c.size() == 0 && c.capacity() == 2);
    c.put(1, "a");
    c.put(2, "b");
    CHECK(c.size() == 2);
    CHECK(c.get(1).has_value() && *c.get(1) == "a");
    c.put(3, "c"); // evicts 2: 1 was touched by get
    CHECK(!c.get(2).has_value());
    CHECK(c.contains(1) && c.contains(3));
    c.put(1, "A"); // overwrite keeps size, refreshes recency
    CHECK(c.get(1).has_value() && *c.get(1) == "A");
    CHECK(c.size() == 2);
    c.put(4, "d"); // evicts 3
    CHECK(!c.contains(3));
    CHECK(c.contains(1) && c.contains(4));
    CHECK(!c.get(99).has_value());

    LruCache<std::string, int> z(0);
    z.put("x", 1);
    CHECK(z.size() == 0 && !z.contains("x") && !z.get("x").has_value());

    // contains() must not refresh recency
    LruCache<int, int> r(2);
    r.put(1, 1);
    r.put(2, 2);
    CHECK(r.contains(1));
    r.put(3, 3); // evicts 1, not 2
    CHECK(!r.contains(1) && r.contains(2) && r.contains(3));

    // churn past capacity
    LruCache<int, std::string> big(16);
    for (int i = 0; i < 1000; ++i) {
        big.put(i, std::to_string(i));
        if (i % 3 == 0) (void)big.get(i / 2);
    }
    CHECK(big.size() == 16);

    std::puts("spec ok");
    return 0;
}
