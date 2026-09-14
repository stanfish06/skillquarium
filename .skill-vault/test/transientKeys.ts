import { isUiUxProMaxSkill } from "../src/catalog";

/**
 * Skill keys a checkout may carry that a committed golden cannot: the optional extras. gstack
 * installs as skills/gstack plus gstack-* / _gstack* scratch copies (src/catalog/discover.ts,
 * src/search/fff.ts); the ui-ux-pro-max bundle folders are listed in src/build/categories.json.
 * Any other key the golden does not know is a real change and has to fail.
 */
export function isInstallableExtra(key: string): boolean {
  return key.startsWith("gstack") || key.startsWith("_gstack") || isUiUxProMaxSkill(key);
}
