import type { Command } from "./cli";
import { loadConfig } from "./config";

export const help = "doctor: report tool availability and embed endpoint reachability";

async function which(bin: string): Promise<string | null> {
  const p = Bun.spawn(["sh", "-c", `command -v ${bin}`], { stdout: "pipe", stderr: "ignore" });
  const out = (await new Response(p.stdout).text()).trim();
  return (await p.exited) === 0 ? out : null;
}

export const run: Command = async (_args, ctx) => {
  const cfg = await loadConfig(ctx.root);
  const rows: [string, string][] = [];
  rows.push(["bun", Bun.version]);
  for (const b of ["rg", "npx", "git"]) rows.push([b, (await which(b)) ?? "MISSING"]);
  try {
    const { FileFinder } = await import("@ff-labs/fff-bun");
    const f = FileFinder.create({ basePath: ctx.root, disableWatch: true });
    rows.push(["fff", f.ok ? "ok" : `FAILED ${f.error}`]);
    if (f.ok) f.value.destroy();
  } catch (e) {
    rows.push(["fff", `FAILED ${(e as Error).message}`]);
  }
  try {
    const r = await fetch(`${cfg.embed.url}/v1/models`, { signal: AbortSignal.timeout(5000) });
    const j = (await r.json()) as { data?: { id: string; meta?: { n_embd?: number } }[] };
    const m = j.data?.[0];
    rows.push(["embed endpoint", `${cfg.embed.url} model=${m?.id ?? "?"} dim=${m?.meta?.n_embd ?? "?"}`]);
  } catch (e) {
    rows.push(["embed endpoint", `${cfg.embed.url} UNREACHABLE (${(e as Error).message})`]);
  }
  if (ctx.json) console.log(JSON.stringify(Object.fromEntries(rows)));
  else for (const [k, v] of rows) console.log(`${k.padEnd(16)} ${v}`);
  return rows.some(([, v]) => v.startsWith("MISSING") || v.startsWith("FAILED")) ? 1 : 0;
};
