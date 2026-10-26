"""Check an existing llama-server's health, model list, and chat or embedding API."""

import argparse
import json
import math
import os
import time
import urllib.error
import urllib.request


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--mode", choices=("chat", "embedding"), required=True)
    parser.add_argument(
        "--model", help="Alias from /v1/models; defaults to its first entry"
    )
    parser.add_argument("--expect-dim", type=int)
    parser.add_argument("--startup-timeout", type=float, default=30)
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    headers = {"Content-Type": "application/json"}
    if key := os.environ.get("LLAMA_API_KEY"):
        headers["Authorization"] = f"Bearer {key}"

    def request(path: str, payload: dict | None = None) -> dict:
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(base + path, data=data, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)

    deadline = time.monotonic() + args.startup_timeout
    while True:
        try:
            health = request("/health")
            assert health.get("status") == "ok", health
            break
        except urllib.error.HTTPError as error:
            if error.code != 503 or time.monotonic() >= deadline:
                raise
            time.sleep(0.5)
        except (urllib.error.URLError, TimeoutError):
            # Loading and connection failures get a bounded startup wait.
            if time.monotonic() >= deadline:
                raise
            time.sleep(0.5)

    models = request("/v1/models")["data"]
    assert models, "No model advertised"
    model = args.model or models[0]["id"]
    assert model in [entry["id"] for entry in models], "Requested alias not advertised"

    if args.mode == "chat":
        result = request(
            "/v1/chat/completions",
            {
                "model": model,
                "messages": [{"role": "user", "content": "Say hello."}],
                "max_tokens": 16,
                "temperature": 0,
            },
        )
        message = result["choices"][0]["message"]
        content = message.get("content") or message.get("reasoning_content")
        assert isinstance(content, str) and content.strip(), "Empty generated output"
        summary = {
            "health": "ok",
            "model": model,
            "mode": "chat",
            "characters": len(content),
        }
    else:
        result = request(
            "/v1/embeddings",
            {
                "model": model,
                "input": ["first text", "second text"],
                "encoding_format": "float",
            },
        )
        rows = sorted(result["data"], key=lambda entry: entry["index"])
        assert [entry["index"] for entry in rows] == [0, 1], "Unexpected batch indices"
        vectors = [entry["embedding"] for entry in rows]
        dimension = len(vectors[0])
        assert dimension > 0 and all(len(vector) == dimension for vector in vectors)
        assert all(math.isfinite(value) for vector in vectors for value in vector)
        assert all(any(value != 0 for value in vector) for vector in vectors)
        if args.expect_dim is not None:
            assert dimension == args.expect_dim, (dimension, args.expect_dim)
        summary = {
            "health": "ok",
            "model": model,
            "mode": "embedding",
            "vectors": 2,
            "dimension": dimension,
        }
    print(json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
