# Skill eval — 2026-09-13T15-52-43-default-d5jsf7

config: default | models: 1 | reps: 3 | cells: 39
provenance: skill:zz-prefix=fccb08fff071 skill:modern-typescript=8936df5f3be4 skill:use-modern-go=0eedae8d0628 skill:use-modern-go:version=v0.1.1 skill:rust-coding-guidelines=8fc1f8308be0 skill:cpp-pro=7b07444d80b0 skill:csharp-developer=aa401a06abae

skill% = traits specified in the skill that the code implements. full% = all specified traits that the code implements.
compiled = compiled and passed tests / total. trunc = hit the output cap. err = gateway or tool failure.

```
model                  task                 skill                  prompt   n   compiled trunc err skill%  full%   think
---------------------- -------------------- ---------------------- -------- --- -------- ----- --- ------- ------- ------
gpt-5.6-luna           ts-control-probe     (none)                 baseline 3   3/3      0     0   0.0     33.3    516
                                            zz-prefix              skill    3   3/3      0     0   100.0   100.0   413
                                                                   delta                           +100.0  +66.7

gpt-5.6-luna           ts-settings-parser   (none)                 baseline 3   3/3      0     0   100.0   100.0   1034
                                            modern-typescript      skill    3   3/3      0     0   100.0   100.0   516
                                                                   delta                           +0.0    +0.0

gpt-5.6-luna           go-batch-processor   (none)                 baseline 3   3/3      0     0   40.0    57.1    516
                                            use-modern-go          skill    3   3/3      0     0   93.3    95.2    526
                                                                   delta                           +53.3   +38.1

gpt-5.6-luna           rust-record-parser   (none)                 baseline 3   3/3      0     0   25.0    47.6    516
                                            rust-coding-guidelines skill    3   3/3      0     0   25.0    52.4    516
                                                                   delta                           +0.0    +4.8

gpt-5.6-luna           cpp-lru-cache        (none)                 baseline 3   3/3      0     0   66.7    76.2    1807
                                            cpp-pro                skill    3   3/3      0     0   73.3    81.0    2504
                                                                   delta                           +6.7    +4.8

gpt-5.6-luna           csharp-order-parser  (none)                 baseline 3   3/3      0     0   0.0     57.1    1552
                                            csharp-developer       skill    3   3/3      0     0   0.0     57.1    1663
                                                                   delta                           +0.0    +0.0

gpt-5.6-luna           c-run-length         (baseline only)        baseline 3   3/3      0     0   100.0   100.0   2070

```

## bench (medians over compiled cells)

```
model                  task                 skill                  prompt       ns/call  bytes allocs failed
gpt-5.6-luna           go-batch-processor   (none)                 baseline     22555    15511 203 0
                                            use-modern-go          skill        22698    14712 203 0

gpt-5.6-luna           rust-record-parser   (none)                 baseline     781777   1375060 15012 0
                                            rust-coding-guidelines skill        799275   1375060 15012 0

gpt-5.6-luna           cpp-lru-cache        (none)                 baseline     131399   213688 8199 0
                                            cpp-pro                skill        132721   213688 8199 0

gpt-5.6-luna           csharp-order-parser  (none)                 baseline     631675   1448144 -   0
                                            csharp-developer       skill        528351   1408160 -   0

gpt-5.6-luna           c-run-length         (baseline only)        baseline     50395    0     0   0

```
Per call of the benchmark body. allocs is `-` for .NET.

## tool-injected skills — routing check

- openai/gpt-5.6-luna / use-modern-go: median 1 tool calls per generation
