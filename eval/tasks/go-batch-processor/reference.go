// Reference solution for `selftest`; baseline shape, not skill-styled.
package solution

import (
	"errors"
	"sync"
)

func ProcessBatches(items []int, batchSize int, fn func([]int) (int, error)) ([]int, error) {
	if batchSize <= 0 || len(items) == 0 {
		return []int{}, nil
	}
	n := (len(items) + batchSize - 1) / batchSize
	results := make([]int, n)
	errs := make([]error, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		start := i * batchSize
		end := start + batchSize
		if end > len(items) {
			end = len(items)
		}
		wg.Add(1)
		go func(i int, batch []int) {
			defer wg.Done()
			results[i], errs[i] = fn(batch)
		}(i, items[start:end])
	}
	wg.Wait()
	return results, errors.Join(errs...)
}
