import { type Catalog as ServiceCatalog, type Product as ServiceProduct, ToggleService } from "../toggle/service"
import type { InvocationState as ToggleInvocationState, Skill } from "../toggle/state"

export type Product = ServiceProduct

export type InvocationState = ToggleInvocationState

export type SkillRecord = Skill

export type Catalog = ServiceCatalog

export interface SkillBackend {
  catalog(): Promise<Catalog>
  setProducts(keys: string[], product: Product, enabled: boolean): Promise<void>
  saveSnapshot(): Promise<string>
  loadSnapshot(): Promise<string>
  preCommitReset(): Promise<string>
}

// In-process backend; the three snapshot methods return the same status lines the CLI prints.
export class LocalSkillBackend implements SkillBackend {
  private readonly service: ToggleService

  constructor(root: string) {
    this.service = new ToggleService(root)
  }

  async catalog(): Promise<Catalog> {
    return this.service.catalog()
  }

  async setProducts(keys: string[], product: Product, enabled: boolean): Promise<void> {
    this.service.setProducts(keys, product, enabled)
  }

  async saveSnapshot(): Promise<string> {
    return `saved\t${this.service.saveSnapshot()}`
  }

  async loadSnapshot(): Promise<string> {
    const { source, changed } = this.service.loadSnapshot()
    return `loaded\t${changed}\t${source}`
  }

  async preCommitReset(): Promise<string> {
    const { snapshot, changed } = this.service.preCommitReset()
    return `reset\t${changed}\t${snapshot}`
  }
}
