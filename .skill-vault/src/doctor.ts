import type { Command, Context } from "./cli";

export const help = "doctor: report tool availability and embed endpoint reachability";

export interface DoctorRow {
  name: string;
  ok: boolean;
  detail: string;
}

// Process lookups are injectable so tests can simulate a missing tool or an offline endpoint.
export interface DoctorDeps {
  which: (bin: string) => string | null;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export async function doctorRows(ctx: Context, deps: DoctorDeps): Promise<DoctorRow[]> {
  const cfg = await ctx.config();
  const rows: DoctorRow[] = [{ name: "bun", ok: true, detail: Bun.version }];
  for (const bin of ["rg", "npx", "git"]) {
    const path = deps.which(bin);
    rows.push({ name: bin, ok: path !== null, detail: path ?? "MISSING" });
  }
  try {
    const { FileFinder } = await import("@ff-labs/fff-bun");
    const f = FileFinder.create({ basePath: ctx.root, disableWatch: true });
    rows.push({ name: "fff", ok: f.ok, detail: f.ok ? "ok" : `FAILED ${f.error}` });
    if (f.ok) f.value.destroy();
  } catch (e) {
    rows.push({ name: "fff", ok: false, detail: `FAILED ${(e as Error).message}` });
  }
  // Endpoint state is informational: an offline embed server does not fail doctor.
  const url = cfg.embed.url;
  try {
    const r = await deps.fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      rows.push({ name: "embed endpoint", ok: true, detail: `${url} HTTP ${r.status}` });
    } else {
      const j = (await r.json()) as { data?: { id: string; meta?: { n_embd?: number } }[] };
      const m = j.data?.[0];
      rows.push({
        name: "embed endpoint",
        ok: true,
        detail: `${url} model=${m?.id ?? "?"} dim=${m?.meta?.n_embd ?? "?"}`,
      });
    }
  } catch (e) {
    rows.push({ name: "embed endpoint", ok: true, detail: `${url} UNREACHABLE (${(e as Error).message})` });
  }
  return rows;
}

export async function runDoctor(ctx: Context, deps: DoctorDeps): Promise<number> {
  const rows = await doctorRows(ctx, deps);
  if (ctx.json) ctx.out(JSON.stringify(Object.fromEntries(rows.map((r) => [r.name, r.detail]))));
  else for (const r of rows) ctx.out(`${r.name.padEnd(16)} ${r.detail}`);
  return rows.some((r) => !r.ok) ? 1 : 0;
}

export const run: Command = (_args, ctx) => runDoctor(ctx, { which: Bun.which, fetch });
