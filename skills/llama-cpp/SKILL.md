---
name: llama-cpp
description: Run GGUF language and embedding models locally with llama.cpp. Use for model and quant selection, CPU/Metal/CUDA builds, llama-server APIs, Hugging Face downloads, conversion, and diagnosing local inference failures.
metadata:
  version: "1.0"
  last-reviewed: "2026-10-24"
---

# llama.cpp

Examples target llama.cpp v0.7.0 (b11669). The HTTP smoke checker uses Python 3.11+.

Use llama.cpp for local GGUF inference and its OpenAI-compatible server. Choose a
model that fits the available memory and task; use a dedicated embedding model
for retrieval. A chat model's hidden states are not a substitute for trained
sentence embeddings.

Commands referencing `scripts/` are relative to this skill's folder.

## Install and choose the backend

Check existing binaries before installing:

```bash
llama-server --version
llama-server --list-devices
```

Use a platform package such as `brew install llama.cpp`, or the matching archive
from [upstream releases](https://github.com/ggml-org/llama.cpp/releases). Keep its
shared libraries alongside the executables. When building from source, pin a
release/commit and use CMake; the old top-level Makefile workflow was removed:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j 4 --target llama-server llama-cli llama-quantize
```

Metal is enabled by default on supported macOS builds. CUDA requires
`-DGGML_CUDA=ON` at configure time; other backends have different prerequisites.
Use the [build guide](https://github.com/ggml-org/llama.cpp/blob/v0.7.0/docs/build.md)
for the selected backend. Binaries built above live in `build/bin/`.
`--n-gpu-layers 0` forces CPU inference; offload layers only after device detection
and a small successful request.

## Select and fetch a GGUF

- Search [Hub models compatible with llama.cpp](https://huggingface.co/models?apps=llama.cpp).
  Verify the repository's model card, license, exact file names and sizes before
  downloading. `mmproj` files are multimodal projectors, not language-model weights.
- Allow memory for weights, KV cache, compute buffers, and parallel slots; file
  size alone does not determine peak usage. Start with a modest context and one
  slot. A smaller quant trades accuracy for size; measure on the user's workload.
- Prefer an existing GGUF over conversion. Shorthand `-hf repo:quant` can select a
  different file if that quant is absent; use `--hf-file` when exact selection matters.

```bash
llama-server --hf-repo OWNER/REPO --hf-file EXACT_MODEL.gguf \
  --host 127.0.0.1 --port 8080 --alias local-chat --ctx-size 4096 --parallel 1
```

For gated repositories, use `HF_TOKEN` in the environment. Once weights are
downloaded, `--model /path/model.gguf --offline` avoids Hub access. Keep the
model repository, revision, file hash, quant, runtime version and launch command
with evaluation results.

## Serve chat and verify it

Set an explicit port: defaults vary between builds. Run the server in the
foreground or record its PID/log location through the environment's job runner.

```bash
llama-server --model /path/chat-model.gguf --offline \
  --host 127.0.0.1 --port 8080 --alias local-chat \
  --ctx-size 4096 --parallel 1 --n-gpu-layers 0
```

Wait for `/health` to return HTTP 200 (`503` means loading), then query
`/v1/models`. The client base URL is `http://127.0.0.1:8080/v1`.

```bash
curl --fail http://127.0.0.1:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"local-chat","messages":[{"role":"user","content":"Reply with one short sentence."}],"max_tokens":32,"temperature":0}'
python3 scripts/smoke_server.py --mode chat --base-url http://127.0.0.1:8080
```

Use the chat template shipped with the model. Only override `--chat-template`
when the model card specifies the format. Valid HTTP output proves the server
interface works; it does not prove the model follows instructions or is accurate.

For shared/network access, configure authentication (`LLAMA_API_KEY` or
`--api-key-file`) before changing the bind address. Pass the same key to clients.
Check the server's own log and process status during lengthy jobs and stop only
the process started for the task.

## Serve embeddings

Run a separate server with an embedding GGUF, using its documented pooling and
query/document prefixes. Do not force a pooling type merely to silence an error.

```bash
llama-server --model /path/embedding-model.gguf --offline --embedding \
  --host 127.0.0.1 --port 8081 --alias local-embedding --parallel 1
python3 scripts/smoke_server.py --mode embedding \
  --base-url http://127.0.0.1:8081 --expect-dim 384
```

Replace `384` with the actual model dimension. `/v1/embeddings` requires pooled
output (`--pooling none` is token-level output). Send
`{"model":"local-embedding","input":["first text","second text"],"encoding_format":"float"}`;
verify two finite vectors of the expected length. The checker reads
`LLAMA_API_KEY` without printing it. Store the model identity, dimension,
normalization, prefixes and pooling with a vector index. Changing these usually
requires re-embedding both documents and queries.

For Skillquarium's embedding service, inspect the existing local configuration
and expected dimension before choosing a model or endpoint. A healthy endpoint
with the wrong dimension cannot regenerate its committed vector index.

## Convert or quantize only when needed

Use the converter and requirements from the same pinned source tree as the
runtime. Check architecture support before downloading full-precision weights:

```bash
uv venv .venv
uv pip install --python .venv/bin/python -r requirements/requirements-convert_hf_to_gguf.txt
.venv/bin/python convert_hf_to_gguf.py /path/hf-model --outfile model-f16.gguf --outtype f16
build/bin/llama-quantize model-f16.gguf model-Q4_K_M.gguf Q4_K_M
```

Keep conversion workspace separate from the original weights. Reserve disk for
both input and output. Compare representative prompts or retrieval metrics
before adopting a smaller quant; avoid fixed claims about speed or quality.

## Diagnose the failure at its boundary

| Symptom | Check |
| --- | --- |
| Unsupported model/tensor errors | Runtime version, GGUF architecture and file completeness; update to a build supporting that architecture. |
| Out of memory | Context, parallel slots and GPU offload first; then a smaller model or quant. |
| HTTP 503 while starting | Loading log, available memory, and eventual health status; a listening socket is insufficient. |
| Gibberish or ignored instructions | Exact weights, chat template and tokenizer compatibility; test the CLI with the same model. |
| Embedding route fails | Dedicated embedding architecture, pooling, context/batch limits and model dimension. |
| Client cannot connect | Bind address, explicit port, base URL ending in `/v1`, authentication and proxy routing. |

Use the [server reference](https://github.com/ggml-org/llama.cpp/blob/v0.7.0/tools/server/README.md)
for endpoint payloads and flags, and the [GGUF Hub guide](https://huggingface.co/docs/hub/gguf-llamacpp)
for model discovery. Check current primary documentation when using another build.
