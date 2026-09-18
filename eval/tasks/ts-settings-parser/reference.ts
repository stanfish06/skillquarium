// Reference solution for `selftest`.
export type Outcome =
  | { kind: "ok"; key: string; value: boolean | number | string }
  | { kind: "error"; key: string; reason: string };

export function parseSetting(key: string, raw: string): Outcome {
  if (raw === "") return { kind: "error", key, reason: "empty" };
  if (raw === "true") return { kind: "ok", key, value: true };
  if (raw === "false") return { kind: "ok", key, value: false };
  if (/^-?\d+$/.test(raw)) return { kind: "ok", key, value: Number(raw) };
  return { kind: "ok", key, value: raw };
}

export function renderSetting(outcome: Outcome): string {
  switch (outcome.kind) {
    case "ok":
      return `${outcome.key}=${String(outcome.value)}`;
    case "error":
      return `${outcome.key}=!${outcome.reason}`;
    default: {
      const exhaustive: never = outcome;
      throw new Error(`unhandled outcome ${String(exhaustive)}`);
    }
  }
}
