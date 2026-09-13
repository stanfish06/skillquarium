Write a self-contained C++23 header `solution.hpp` (standard library only)
implementing a fixed-capacity least-recently-used cache.

```cpp
template <typename Key, typename Value>
class LruCache {
public:
    explicit LruCache(std::size_t capacity);

    // Insert or overwrite. The key becomes most recently used. When the cache
    // is full, the least recently used entry is evicted first.
    void put(const Key& key, const Value& value);

    // Returns the value and marks the key most recently used, or std::nullopt.
    std::optional<Value> get(const Key& key);

    // True if present. Does not change recency.
    bool contains(const Key& key) const;

    std::size_t size() const;
    std::size_t capacity() const;
};
```

Behaviour:

1. `put` and `get` are O(1) average.
2. Capacity 0 stores nothing: `put` is a no-op and `size()` stays 0.
3. Keys need only be hashable and equality-comparable (usable as an
   `std::unordered_map` key). Values are copyable.
4. The header must compile with `-std=c++23 -Wall -Wextra` and run clean
   under AddressSanitizer and UndefinedBehaviorSanitizer.

Return only the contents of `solution.hpp` in a single C++ code block.
