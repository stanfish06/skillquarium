//! Bench runner. task.rs (the task's bench.rs) provides `setup() -> Input` and `run(&Input) -> u64`.
#![allow(dead_code)]
mod task;

use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::sync::atomic::{AtomicU64, Ordering::Relaxed};
use std::time::Instant;

static ALLOCS: AtomicU64 = AtomicU64::new(0);
static BYTES: AtomicU64 = AtomicU64::new(0);

struct Counting;

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Relaxed);
        BYTES.fetch_add(layout.size() as u64, Relaxed);
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        ALLOCS.fetch_add(1, Relaxed);
        BYTES.fetch_add(new_size as u64, Relaxed);
        unsafe { System.realloc(ptr, layout, new_size) }
    }
}

#[global_allocator]
static GLOBAL: Counting = Counting;

fn main() {
    let input = task::setup();
    black_box(task::run(&input)); // warm-up

    // calibrate n to ~0.3 s
    let mut n: u64 = 1;
    loop {
        let t = Instant::now();
        for _ in 0..n {
            black_box(task::run(&input));
        }
        if t.elapsed().as_millis() >= 300 || n >= 1 << 24 {
            break;
        }
        n *= 2;
    }

    ALLOCS.store(0, Relaxed);
    BYTES.store(0, Relaxed);
    let t = Instant::now();
    for _ in 0..n {
        black_box(task::run(&input));
    }
    let ns = t.elapsed().as_nanos() as f64;
    println!(
        "BENCH ns/op={:.3} B/op={:.3} allocs/op={:.3}",
        ns / n as f64,
        BYTES.load(Relaxed) as f64 / n as f64,
        ALLOCS.load(Relaxed) as f64 / n as f64,
    );
}
