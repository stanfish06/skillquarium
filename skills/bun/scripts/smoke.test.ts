import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

test("serves requests and releases the listening socket", async () => {
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request) {
			return new URL(request.url).pathname === "/health"
				? Response.json({ status: "ok" })
				: new Response("Not Found", { status: 404 });
		},
	});
	const endpoint = new URL("/health", server.url);

	try {
		const response = await fetch(endpoint);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
		const missing = await fetch(new URL("/missing", server.url));
		expect(missing.status).toBe(404);
		await missing.text();
	} finally {
		// Close keep-alive connections even when an assertion fails.
		await server.stop(true);
	}

	await expect(
		fetch(endpoint, { signal: AbortSignal.timeout(1000) }),
	).rejects.toThrow();
});

test("builds a Bun-target module that executes with the expected export", async () => {
	const directory = await mkdtemp(join(tmpdir(), "bun-skill-smoke-"));

	try {
		const entrypoint = join(directory, "entry.ts");
		await Bun.write(entrypoint, "export const answer: number = 6 * 7;\n");
		const result = await Bun.build({
			entrypoints: [entrypoint],
			outdir: join(directory, "dist"),
			target: "bun",
		});
		expect(result.success).toBe(true);
		const output = result.outputs[0];
		if (!output) throw new Error("Bun.build produced no artifact");
		const built: { answer: unknown } = await import(
			pathToFileURL(output.path).href
		);
		expect(built.answer).toBe(42);
	} finally {
		// Remove generated inputs and build output after every run.
		await rm(directory, { recursive: true, force: true });
	}
});
