import categories from "../build/categories.json";

// Folders that exist only when the optional UI/UX extra is installed (build.py UI_UX_PRO_MAX_SKILLS).
const UI_UX_PRO_MAX_SKILLS = new Set<string>(categories.uiUxProMaxSkills);

export function isUiUxProMaxSkill(id: string): boolean {
  return UI_UX_PRO_MAX_SKILLS.has(id);
}
