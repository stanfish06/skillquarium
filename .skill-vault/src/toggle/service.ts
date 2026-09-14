import { setSkillEnabled, setSkillProductStates, toggleSkill } from "./edit";
import { preCommitReset } from "./reset";
import { loadSnapshot, saveSnapshot } from "./snapshot";
import { discover, MetadataError, resolveRoot, type Skill } from "./state";

export type Product = "both" | "claude" | "codex";

export interface Catalog {
  skills: Skill[];
  categories: string[];
}

/** One entry point over the toggle modules for both the CLI commands and the TUI backend. */
export class ToggleService {
  readonly root: string;

  constructor(root: string) {
    this.root = resolveRoot(root);
  }

  discover(): Skill[] {
    return discover(this.root);
  }

  /** `categories` deduped and sorted case-insensitively. */
  catalog(): Catalog {
    const skills = this.discover();
    const categories = [...new Set(skills.map((skill) => skill.category))].sort((a, b) => {
      const al = a.toLowerCase();
      const bl = b.toLowerCase();
      return al < bl ? -1 : al > bl ? 1 : 0;
    });
    return { skills, categories };
  }

  /** Exact key match first, then exact display-name match; unknown or ambiguous names throw. */
  resolveSkills(values: string[]): Skill[] {
    const skills = this.discover();
    const byKey = new Map(skills.map((skill) => [skill.key, skill]));
    const byName = new Map<string, Skill[]>();
    for (const skill of skills) {
      const bucket = byName.get(skill.name);
      if (bucket) bucket.push(skill);
      else byName.set(skill.name, [skill]);
    }
    return values.map((value) => {
      const byKeyMatch = byKey.get(value);
      if (byKeyMatch) return byKeyMatch;
      const matches = byName.get(value) ?? [];
      const only = matches[0];
      if (matches.length === 1 && only) return only;
      if (matches.length > 1) {
        const keys = matches.map((skill) => skill.key).join(", ");
        throw new MetadataError(`ambiguous skill name '${value}'; use one of: ${keys}`);
      }
      throw new MetadataError(`unknown skill: ${value}`);
    });
  }

  /** `enable`/`disable` for one product or both; returns each skill as reloaded after its edit. */
  setProducts(keys: string[], product: Product, enabled: boolean): Skill[] {
    return this.resolveSkills(keys).map((skill) => {
      if (product === "both") return setSkillEnabled(skill, enabled);
      return setSkillProductStates(skill, product === "claude" ? { claude: enabled } : { codex: enabled });
    });
  }

  /** `toggle`: both flips to enabled unless fully enabled; one product flips its own flag. */
  toggle(keys: string[], product: Product): Skill[] {
    return this.resolveSkills(keys).map((skill) => {
      if (product === "both") return toggleSkill(skill);
      if (product === "claude") {
        if (skill.claude_enabled === null) throw new MetadataError(`${skill.key}: Claude metadata error`);
        return setSkillProductStates(skill, { claude: !skill.claude_enabled });
      }
      if (skill.codex_enabled === null) throw new MetadataError(`${skill.key}: Codex metadata error`);
      return setSkillProductStates(skill, { codex: !skill.codex_enabled });
    });
  }

  saveSnapshot(path?: string): string {
    return saveSnapshot(this.root, path);
  }

  loadSnapshot(path?: string): { source: string; changed: number } {
    return loadSnapshot(this.root, path);
  }

  preCommitReset(snapshot?: string): { snapshot: string; changed: number } {
    const [path, changed] = preCommitReset(this.root, snapshot);
    return { snapshot: path, changed };
  }
}
