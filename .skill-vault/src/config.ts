// Placeholder until the real config loader lands; only the embed URL is read.
export async function loadConfig(_root: string): Promise<{ embed: { url: string } }> {
  return { embed: { url: process.env.SKILLQUARIUM_EMBED_URL ?? "http://127.0.0.1:8080" } };
}
