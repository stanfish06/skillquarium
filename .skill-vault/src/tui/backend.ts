export type Product = "both" | "claude" | "codex"

export type InvocationState = "enabled" | "disabled" | "mixed" | "error"

export interface SkillRecord {
  key: string
  name: string
  description: string
  directory: string
  category: string
  claude_enabled: boolean | null
  codex_enabled: boolean | null
  state: InvocationState
  error: string | null
}

export interface Catalog {
  skills: SkillRecord[]
  categories: string[]
}

export interface SkillBackend {
  catalog(): Promise<Catalog>
  setProducts(keys: string[], product: Product, enabled: boolean): Promise<void>
  saveSnapshot(): Promise<string>
  loadSnapshot(): Promise<string>
  preCommitReset(): Promise<string>
}

export class PythonSkillBackend implements SkillBackend {
  constructor(
    private readonly root: string,
    private readonly script: string,
    private readonly python = "python3",
  ) {}

  private async run(...args: string[]): Promise<string> {
    const process = Bun.spawn([this.python, this.script, "--root", this.root, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ])
    if (exitCode !== 0) {
      throw new Error(stderr.trim() || `skill backend exited with status ${exitCode}`)
    }
    return stdout.trim()
  }

  async catalog(): Promise<Catalog> {
    const value: unknown = JSON.parse(await this.run("catalog"))
    if (!value || typeof value !== "object" || !("skills" in value) || !("categories" in value)) {
      throw new Error("skill backend returned an invalid catalog")
    }
    return value as Catalog
  }

  async setProducts(keys: string[], product: Product, enabled: boolean): Promise<void> {
    await this.run(enabled ? "enable" : "disable", "--product", product, ...keys)
  }

  saveSnapshot(): Promise<string> {
    return this.run("save")
  }

  loadSnapshot(): Promise<string> {
    return this.run("load")
  }

  preCommitReset(): Promise<string> {
    return this.run("pre-commit-reset")
  }
}
