import categories from "../build/categories.json";

// Folders that exist only when the optional UI/UX extra is installed (build.py UI_UX_PRO_MAX_SKILLS).
const UI_UX_PRO_MAX_SKILLS = new Set<string>(categories.uiUxProMaxSkills);

export function isUiUxProMaxSkill(id: string): boolean {
  return UI_UX_PRO_MAX_SKILLS.has(id);
}

/**
 * Skills that only exist when an optional extra is installed, so nothing committed to the repo
 * may depend on them. `discoverSkills` keeps bare `gstack` for parity with the toggle commands;
 * anything writing a tracked artifact filters with this instead.
 */
export function isInstallableExtra(id: string): boolean {
  return id === "gstack" || id.startsWith("gstack-") || id.startsWith("_gstack") || isUiUxProMaxSkill(id);
}
