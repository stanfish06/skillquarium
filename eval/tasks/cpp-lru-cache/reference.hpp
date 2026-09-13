// Reference solution for `selftest`; baseline shape, not skill-styled.
#pragma once

#include <cstddef>
#include <list>
#include <optional>
#include <unordered_map>
#include <utility>

template <typename Key, typename Value>
class LruCache {
public:
    explicit LruCache(std::size_t capacity) : capacity_(capacity) {}

    void put(const Key& key, const Value& value) {
        if (capacity_ == 0) return;
        auto it = index_.find(key);
        if (it != index_.end()) {
            it->second->second = value;
            order_.splice(order_.begin(), order_, it->second);
            return;
        }
        if (order_.size() >= capacity_) {
            index_.erase(order_.back().first);
            order_.pop_back();
        }
        order_.emplace_front(key, value);
        index_.emplace(key, order_.begin());
    }

    std::optional<Value> get(const Key& key) {
        auto it = index_.find(key);
        if (it == index_.end()) return std::nullopt;
        order_.splice(order_.begin(), order_, it->second);
        return it->second->second;
    }

    bool contains(const Key& key) const { return index_.find(key) != index_.end(); }
    std::size_t size() const { return order_.size(); }
    std::size_t capacity() const { return capacity_; }

private:
    using Entry = std::pair<Key, Value>;
    std::size_t capacity_;
    std::list<Entry> order_;
    std::unordered_map<Key, typename std::list<Entry>::iterator> index_;
};
