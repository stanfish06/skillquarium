import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  LinearScrollAccel,
  ScrollBoxRenderable,
  TextAttributes,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
  type MouseEvent,
} from "@opentui/core"

import type { Catalog, Product, SkillBackend, SkillRecord } from "./backend"
import type { ArmStats, BenchRow, EvalRun, EvalSource } from "./evalruns"

const COLORS = {
  background: "#111318",
  panel: "#181b22",
  panelAlt: "#20242d",
  border: "#4b5563",
  accent: "#7dd3fc",
  selected: "#263449",
  text: "#e5e7eb",
  muted: "#9ca3af",
  enabled: "#86efac",
  disabled: "#fca5a5",
  mixed: "#fde68a",
  error: "#f0abfc",
}

const NAME_COLUMN_GROW = 3
const CATEGORY_COLUMN_GROW = 2
const NAME_COLUMN_MIN_WIDTH = 14
const CATEGORY_COLUMN_MIN_WIDTH = 12
const MARK_COLUMN_WIDTH = 5
const PRODUCT_COLUMN_WIDTH = 9

const BENCH_SKILL_GROW = 4
const BENCH_TEXT_GROW = 3
const BENCH_TEXT_MIN_WIDTH = 16
const BENCH_MODEL_GROW = 2
const BENCH_MODEL_MIN_WIDTH = 14
const BENCH_GATE_WIDTH = 10
const BENCH_PCT_WIDTH = 13
const BENCH_DELTA_WIDTH = 8

export const STATUS_FILTERS = [
  "all",
  "enabled",
  "disabled",
  "mixed",
  "error",
  "claude:on",
  "claude:off",
  "codex:on",
  "codex:off",
] as const

export type StatusFilter = (typeof STATUS_FILTERS)[number]

export type Tab = "skills" | "bench"

function fuzzyTokenScore(token: string, value: string): number | null {
  const direct = value.indexOf(token)
  if (direct >= 0) return 200 - direct - Math.max(0, value.length - token.length) * 0.01

  let cursor = 0
  let first = -1
  let previous = -1
  let gaps = 0
  for (const character of token) {
    const index = value.indexOf(character, cursor)
    if (index < 0) return null
    if (first < 0) first = index
    if (previous >= 0) gaps += index - previous - 1
    previous = index
    cursor = index + 1
  }
  return 100 - first - gaps * 2
}

export function fuzzyScore(query: string, skill: SkillRecord): number | null {
  const tokens = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  const identity = `${skill.name} ${skill.key} ${skill.category}`.toLocaleLowerCase()
  const description = skill.description.toLocaleLowerCase()
  let score = 0
  for (const token of tokens) {
    const identityScore = fuzzyTokenScore(token, identity)
    const descriptionIndex = description.indexOf(token)
    const tokenScore = identityScore ?? (descriptionIndex >= 0 ? 75 - descriptionIndex * 0.01 : null)
    if (tokenScore === null) return null
    score += tokenScore
  }
  return score
}

function matchesStatus(skill: SkillRecord, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true
    case "enabled":
    case "disabled":
    case "mixed":
    case "error":
      return skill.state === filter
    case "claude:on":
      return skill.claude_enabled === true
    case "claude:off":
      return skill.claude_enabled === false
    case "codex:on":
      return skill.codex_enabled === true
    case "codex:off":
      return skill.codex_enabled === false
  }
}

export function filterSkills(
  skills: SkillRecord[],
  query: string,
  statusFilter: StatusFilter,
  categoryFilter: string,
): SkillRecord[] {
  return skills
    .map((skill) => ({ skill, score: fuzzyScore(query, skill) }))
    .filter(
      (entry): entry is { skill: SkillRecord; score: number } =>
        entry.score !== null &&
        matchesStatus(entry.skill, statusFilter) &&
        (categoryFilter === "all" || entry.skill.category === categoryFilter),
    )
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name))
    .map((entry) => entry.skill)
}

function stateColor(skill: SkillRecord): string {
  return COLORS[skill.state]
}

function productLabel(enabled: boolean | null): string {
  if (enabled === null) return "! error"
  return enabled ? "● on" : "○ off"
}

function productColor(enabled: boolean | null): string {
  if (enabled === null) return COLORS.error
  return enabled ? COLORS.enabled : COLORS.disabled
}

export interface BenchItem {
  key: string
  skill: string
  task: string
  model: string
  row: BenchRow | null
}

/** One item per report row, plus one placeholder per benchmarked skill the run has no row for. */
export function buildBenchItems(run: EvalRun | null, benchmarkedSkills: string[]): BenchItem[] {
  const items: BenchItem[] = []
  const seen = new Set<string>()
  for (const row of run?.rows ?? []) {
    const skill = row.skill ?? "(none)"
    if (row.skill) seen.add(row.skill)
    items.push({ key: `${skill}|${row.task}|${row.model}`, skill, task: row.task, model: row.model, row })
  }
  for (const skill of benchmarkedSkills) {
    if (!seen.has(skill)) items.push({ key: `${skill}|-|-`, skill, task: "-", model: "-", row: null })
  }
  return items.sort(
    (left, right) =>
      left.skill.localeCompare(right.skill) || left.task.localeCompare(right.task) || left.model.localeCompare(right.model),
  )
}

const pct = (value: number | null | undefined) => (value === null || value === undefined ? "-" : (value * 100).toFixed(1))
const pctPair = (base: ArmStats, skill: ArmStats | null, field: "subset" | "full") =>
  skill ? `${pct(base[field])}→${pct(skill[field])}` : pct(base[field])
const delta = (base: ArmStats, skill: ArmStats | null, field: "subset" | "full") => {
  if (!skill || base[field] === null || skill[field] === null) return "-"
  const value = (skill[field] - base[field]) * 100
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`
}
const deltaColor = (text: string) =>
  text.startsWith("+") && text !== "+0.0" ? COLORS.enabled : text.startsWith("-") && text !== "-" ? COLORS.disabled : COLORS.muted
const gate = (stats: ArmStats) => `${stats.ok}/${stats.gated}`
const num = (value: number | null | undefined) => (value === null || value === undefined ? "-" : String(Math.round(value)))
const modelName = (model: string) => model.split("/").pop() ?? model

interface ButtonParts {
  box: BoxRenderable
  label: TextRenderable
}

export class SkillquariumApp {
  private catalogData: Catalog
  private query = ""
  private statusFilter: StatusFilter = "all"
  private categoryFilter = "all"
  private categories: string[]
  private filtered: SkillRecord[] = []
  private selectedKey: string | null = null
  private readonly markedKeys = new Set<string>()
  private busy = false
  private resetArmedAt = 0
  private activeTab: Tab = "skills"

  private readonly root: BoxRenderable
  private readonly search: InputRenderable
  private readonly summary: TextRenderable
  private readonly statusButton: ButtonParts
  private readonly categoryButton: ButtonParts
  private readonly tabButtons: Record<Tab, ButtonParts>
  private readonly skillsView: BoxRenderable
  private readonly list: ScrollBoxRenderable
  private readonly detail: TextRenderable
  private readonly shortcuts: TextRenderable
  private readonly message: TextRenderable
  private rows: BoxRenderable[] = []
  private rowByKey = new Map<string, BoxRenderable>()
  private markCellByKey = new Map<string, TextRenderable>()

  private readonly benchView: BoxRenderable
  private readonly benchRunButton: ButtonParts
  private readonly benchList: ScrollBoxRenderable
  private readonly benchDetail: TextRenderable
  private benchRows: BoxRenderable[] = []
  private benchRowByKey = new Map<string, BoxRenderable>()
  private benchItems: BenchItem[] = []
  private benchSelectedKey: string | null = null
  private benchmarkedSkills: string[] = []
  private runIds: string[] = []
  private runIndex = -1
  private run: EvalRun | null = null
  private benchError: string | null = null
  private readonly help: BoxRenderable

  constructor(
    private readonly renderer: CliRenderer,
    private readonly backend: SkillBackend,
    catalog: Catalog,
    initialQuery = "",
    private readonly evalSource?: EvalSource,
  ) {
    this.catalogData = catalog
    this.categories = ["all", ...catalog.categories]
    this.query = initialQuery

    this.root = new BoxRenderable(renderer, {
      id: "skillquarium-app",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: COLORS.background,
      padding: 1,
      gap: 1,
    })

    const heading = new BoxRenderable(renderer, {
      id: "heading",
      width: "100%",
      height: 1,
      flexDirection: "row",
      justifyContent: "space-between",
    })
    heading.add(
      new TextRenderable(renderer, {
        id: "title",
        content: "Skillquarium",
        fg: COLORS.accent,
        attributes: TextAttributes.BOLD,
        height: 1,
      }),
    )
    this.summary = new TextRenderable(renderer, {
      id: "summary",
      content: "",
      fg: COLORS.muted,
      height: 1,
    })
    heading.add(this.summary)
    this.root.add(heading)

    const tabs = new BoxRenderable(renderer, {
      id: "tabs",
      width: "100%",
      height: 1,
      flexDirection: "row",
      gap: 1,
    })
    this.tabButtons = {
      skills: this.createButton("tab-skills", "1 Skills", 12, () => this.showTab("skills")),
      bench: this.createButton("tab-bench", "2 Benchmarks", 15, () => this.showTab("bench")),
    }
    tabs.add(this.tabButtons.skills.box)
    tabs.add(this.tabButtons.bench.box)
    tabs.add(
      new TextRenderable(renderer, {
        id: "tabs-help",
        content: "Tab switches",
        fg: COLORS.muted,
        height: 1,
      }),
    )
    this.root.add(tabs)

    this.skillsView = new BoxRenderable(renderer, {
      id: "skills-view",
      width: "100%",
      flexGrow: 1,
      flexDirection: "column",
      gap: 1,
    })

    const searchBar = new BoxRenderable(renderer, {
      id: "search-bar",
      width: "100%",
      height: 3,
      borderStyle: "rounded",
      borderColor: COLORS.border,
      backgroundColor: COLORS.panel,
      paddingX: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 1,
    })
    searchBar.add(
      new TextRenderable(renderer, {
        id: "search-label",
        content: "Search",
        fg: COLORS.muted,
        width: 7,
        height: 1,
      }),
    )
    this.search = new InputRenderable(renderer, {
      id: "search-input",
      value: initialQuery,
      placeholder: "fuzzy find by name, description, or category…",
      flexGrow: 1,
      backgroundColor: COLORS.panelAlt,
      focusedBackgroundColor: COLORS.selected,
      textColor: COLORS.text,
      cursorColor: COLORS.accent,
    })
    this.search.on(InputRenderableEvents.INPUT, (value: string) => {
      this.query = value
      this.applyFilters()
    })
    searchBar.add(this.search)
    searchBar.add(this.createButton("save", "Save", 9, () => void this.saveSnapshot()).box)
    searchBar.add(this.createButton("reload", "Reload", 10, () => void this.loadSnapshot()).box)
    searchBar.add(this.createButton("reset", "Activate all", 14, () => void this.armOrReset()).box)
    this.skillsView.add(searchBar)

    const filters = new BoxRenderable(renderer, {
      id: "filters",
      width: "100%",
      height: 3,
      borderStyle: "rounded",
      borderColor: COLORS.border,
      backgroundColor: COLORS.panel,
      paddingX: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 1,
    })
    filters.add(
      new TextRenderable(renderer, {
        id: "filter-label",
        content: "Filters",
        fg: COLORS.muted,
        width: 7,
        height: 1,
      }),
    )
    this.statusButton = this.createButton("status-filter", "", 20, (event) =>
      this.cycleStatus(event.modifiers.ctrl ? -1 : 1),
    )
    this.categoryButton = this.createButton("category-filter", "", 30, (event) =>
      this.cycleCategory(event.modifiers.ctrl ? -1 : 1),
    )
    filters.add(this.statusButton.box)
    filters.add(this.categoryButton.box)
    filters.add(this.createButton("reset-filters", "Reset", 9, () => this.resetFilters()).box)
    filters.add(
      new TextRenderable(renderer, {
        id: "filter-help",
        content: "click / Ctrl-click to cycle",
        fg: COLORS.muted,
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 0,
        overflow: "hidden",
        height: 1,
      }),
    )
    this.skillsView.add(filters)

    const content = new BoxRenderable(renderer, {
      id: "content",
      width: "100%",
      flexGrow: 1,
      flexDirection: "row",
      gap: 1,
      overflow: "hidden",
    })
    const listPanel = new BoxRenderable(renderer, {
      id: "list-panel",
      flexGrow: 2,
      flexBasis: 0,
      // minimums in the same 2:1 ratio as flex growth keeps the pane ratio stable
      minWidth: 48,
      flexShrink: 1,
      height: "100%",
      borderStyle: "rounded",
      borderColor: COLORS.border,
      title: " Skills ",
      titleColor: COLORS.accent,
      backgroundColor: COLORS.panel,
      flexDirection: "column",
      // no overflow: "hidden": OpenTUI 0.5.1 offsets a bordered box's hit-grid
      // scissor by its border and the scrollbar column loses mouse events
    })
    const columns = new BoxRenderable(renderer, {
      id: "columns",
      width: "100%",
      height: 1,
      flexDirection: "row",
      backgroundColor: COLORS.panelAlt,
      // match the scrollbox's 1-cell scrollbar inset
      paddingRight: 1,
    })
    columns.add(this.tableCell("column-mark", "Mark", COLORS.muted, undefined, undefined, MARK_COLUMN_WIDTH))
    columns.add(
      this.tableCell("column-name", "Skill", COLORS.muted, NAME_COLUMN_GROW, NAME_COLUMN_MIN_WIDTH, undefined, 2),
    )
    columns.add(
      this.tableCell("column-category", "Category", COLORS.muted, CATEGORY_COLUMN_GROW, CATEGORY_COLUMN_MIN_WIDTH),
    )
    columns.add(this.tableCell("column-claude", "Claude", COLORS.muted, undefined, undefined, PRODUCT_COLUMN_WIDTH))
    columns.add(this.tableCell("column-codex", "Codex", COLORS.muted, undefined, undefined, PRODUCT_COLUMN_WIDTH))
    listPanel.add(columns)
    this.list = this.createScrollList("skill-list")
    this.installScrollbarDrag(this.list)
    listPanel.add(this.list)
    content.add(listPanel)

    const detailPanel = this.createDetailPanel("detail-panel", " Details ")
    this.detail = detailPanel.text
    content.add(detailPanel.box)
    this.skillsView.add(content)
    this.root.add(this.skillsView)

    this.benchView = new BoxRenderable(renderer, {
      id: "bench-view",
      width: "100%",
      flexGrow: 1,
      flexDirection: "column",
      gap: 1,
      visible: false,
    })
    const benchBar = new BoxRenderable(renderer, {
      id: "bench-bar",
      width: "100%",
      height: 3,
      borderStyle: "rounded",
      borderColor: COLORS.border,
      backgroundColor: COLORS.panel,
      paddingX: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 1,
    })
    benchBar.add(new TextRenderable(renderer, { id: "bench-run-label", content: "Run", fg: COLORS.muted, width: 4, height: 1 }))
    benchBar.add(this.createButton("bench-prev", "‹", 3, () => void this.cycleRun(-1)).box)
    this.benchRunButton = this.createButton("bench-run", "", 44, () => void this.cycleRun(1))
    benchBar.add(this.benchRunButton.box)
    benchBar.add(this.createButton("bench-next", "›", 3, () => void this.cycleRun(1)).box)
    benchBar.add(this.createButton("bench-refresh", "Refresh", 10, () => void this.loadBench(true)).box)
    benchBar.add(
      new TextRenderable(renderer, {
        id: "bench-help",
        content: "[ ] switch run   eval/README.md explains the columns",
        fg: COLORS.muted,
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 0,
        overflow: "hidden",
        height: 1,
      }),
    )
    this.benchView.add(benchBar)

    const benchContent = new BoxRenderable(renderer, {
      id: "bench-content",
      width: "100%",
      flexGrow: 1,
      flexDirection: "row",
      gap: 1,
      overflow: "hidden",
    })
    const benchPanel = new BoxRenderable(renderer, {
      id: "bench-panel",
      flexGrow: 2,
      flexBasis: 0,
      minWidth: 48,
      flexShrink: 1,
      height: "100%",
      borderStyle: "rounded",
      borderColor: COLORS.border,
      title: " Benchmarked skills ",
      titleColor: COLORS.accent,
      backgroundColor: COLORS.panel,
      flexDirection: "column",
    })
    const benchColumns = new BoxRenderable(renderer, {
      id: "bench-columns",
      width: "100%",
      height: 1,
      flexDirection: "row",
      backgroundColor: COLORS.panelAlt,
      paddingRight: 1,
    })
    for (const cell of this.benchCells("bench-column", {
      skill: "Skill",
      task: "Task",
      model: "Model",
      gate: "gate",
      subset: "skill% b→s",
      full: "full% b→s",
      dSubset: "Δskill",
      dFull: "Δfull",
    })) {
      benchColumns.add(cell)
    }
    benchPanel.add(benchColumns)
    this.benchList = this.createScrollList("bench-list")
    this.installScrollbarDrag(this.benchList)
    benchPanel.add(this.benchList)
    benchContent.add(benchPanel)
    const benchDetailPanel = this.createDetailPanel("bench-detail-panel", " Result ")
    this.benchDetail = benchDetailPanel.text
    benchContent.add(benchDetailPanel.box)
    this.benchView.add(benchContent)
    this.root.add(this.benchView)

    this.help = new BoxRenderable(renderer, {
      id: "bench-help-overlay",
      position: "absolute",
      left: "10%",
      top: 4,
      width: "80%",
      zIndex: 10,
      visible: false,
      borderStyle: "rounded",
      borderColor: COLORS.accent,
      title: " Benchmark columns ",
      titleColor: COLORS.accent,
      backgroundColor: COLORS.panelAlt,
      padding: 1,
      onMouseDown: (event) => {
        event.stopPropagation()
        this.toggleHelp()
      },
    })
    this.help.add(
      new TextRenderable(renderer, {
        id: "bench-help-text",
        fg: COLORS.text,
        width: "100%",
        content: [
          "Every task has a rubric of traits, each a regex checked against the generated code. A trait is",
          "either prescribed by the skill under test or blind: a quality check no skill asks for.",
          "",
          "skill%   traits prescribed by this skill that the code satisfies, as a percentage of those traits",
          "full%    traits satisfied out of the whole rubric, blind traits included",
          "b→s      baseline arm → skill arm. Baseline is the task alone; skill adds SKILL.md to the system prompt",
          "Δskill   skill% in the skill arm minus skill% in the baseline arm, percentage points",
          "Δfull    same for full%",
          "gate     cells that compiled and passed the task's behaviour check / cells that reached the gate,",
          "         per arm. Only gate-passing cells count toward the percentages",
          "trunc    generations that hit the output token cap",
          "err      gateway or tool failures",
          "think    median reasoning tokens per generation",
          "bench    median over gate-passing cells; compare arms on B/op and allocs/op, ns/op is noisy",
          "",
          "? or Esc closes",
        ].join("\n"),
      }),
    )
    this.root.add(this.help)

    const footer = new BoxRenderable(renderer, {
      id: "footer",
      width: "100%",
      height: 2,
      flexDirection: "column",
    })
    this.shortcuts = new TextRenderable(renderer, {
      id: "shortcuts",
      content: "",
      fg: COLORS.muted,
      height: 1,
    })
    footer.add(this.shortcuts)
    this.message = new TextRenderable(renderer, {
      id: "message",
      content: "Ready",
      fg: COLORS.accent,
      height: 1,
    })
    footer.add(this.message)
    this.root.add(footer)

    this.renderer.root.add(this.root)
    this.renderer.keyInput.on("keypress", this.handleKey)
    this.applyFilters()
    this.updateTabChrome()
    this.search.focus()
    void this.loadBench()
  }

  private cellText(
    id: string,
    content: string,
    width: number | "auto" | `${number}%`,
    color: string,
  ): TextRenderable {
    return new TextRenderable(this.renderer, {
      id,
      content,
      width,
      height: 1,
      fg: color,
      selectable: false,
    })
  }

  private tableCell(
    id: string,
    content: string,
    color: string,
    flexGrow?: number,
    minWidth?: number,
    width?: number,
    paddingLeft = 1,
  ): BoxRenderable {
    const cell = new BoxRenderable(this.renderer, {
      id,
      flexGrow,
      flexBasis: flexGrow === undefined ? undefined : 0,
      minWidth,
      width,
      height: 1,
      paddingLeft,
      paddingRight: 1,
      overflow: "hidden",
    })
    cell.add(
      new TextRenderable(this.renderer, {
        id: `${id}-label`,
        content,
        width: "100%",
        height: 1,
        fg: color,
        selectable: false,
      }),
    )
    return cell
  }

  private createButton(
    id: string,
    content: string,
    width: number,
    action: (event: MouseEvent) => void,
  ): ButtonParts {
    const box = new BoxRenderable(this.renderer, {
      id: `button-${id}`,
      width,
      height: 1,
      backgroundColor: COLORS.panelAlt,
      onMouseDown: (event) => {
        event.stopPropagation()
        this.search?.blur()
        action(event)
      },
      onMouseOver: () => {
        box.backgroundColor = COLORS.selected
      },
      onMouseOut: () => {
        box.backgroundColor = COLORS.panelAlt
      },
    })
    const label = this.cellText(`button-${id}-label`, ` ${content}`, "100%", COLORS.text)
    box.add(label)
    return { box, label }
  }

  private createScrollList(id: string): ScrollBoxRenderable {
    const list = new ScrollBoxRenderable(this.renderer, {
      id,
      width: "100%",
      flexGrow: 1,
      scrollY: true,
      scrollAcceleration: new LinearScrollAccel(),
      viewportCulling: true,
      scrollbarOptions: {
        showArrows: false,
        trackOptions: {
          foregroundColor: COLORS.accent,
          backgroundColor: COLORS.panelAlt,
        },
      },
      contentOptions: {
        flexDirection: "column",
      },
    })
    // a focused scrollbox consumes movement keys; selection movement owns scrolling
    list.focusable = false
    return list
  }

  private createDetailPanel(id: string, title: string): { box: BoxRenderable; text: TextRenderable } {
    const box = new BoxRenderable(this.renderer, {
      id,
      flexGrow: 1,
      flexBasis: 0,
      flexShrink: 1,
      minWidth: 24,
      height: "100%",
      borderStyle: "rounded",
      borderColor: COLORS.border,
      title,
      titleColor: COLORS.accent,
      backgroundColor: COLORS.panel,
      overflow: "hidden",
    })
    const inner = new BoxRenderable(this.renderer, {
      id: `${id}-content`,
      width: "100%",
      height: "100%",
      padding: 1,
      overflow: "hidden",
    })
    const text = new TextRenderable(this.renderer, {
      id: id === "detail-panel" ? "detail-text" : `${id}-text`,
      content: "",
      fg: COLORS.text,
      width: "100%",
      height: "100%",
    })
    inner.add(text)
    box.add(inner)
    return { box, text }
  }

  private installScrollbarDrag(list: ScrollBoxRenderable): void {
    // the renderer only captures a drag target once a drag event fires over the
    // 1-cell scrollbar; track thumb presses here and forward bubbled drag/up
    const slider = list.verticalScrollBar.slider
    const listeners = (slider as unknown as {
      _mouseListeners: Record<string, (event: MouseEvent) => void>
    })._mouseListeners
    const sliderDown = listeners["down"]
    const sliderDrag = listeners["drag"]
    const sliderUp = listeners["up"]
    if (!sliderDown || !sliderDrag || !sliderUp) return
    let dragging = false
    slider.onMouseDown = (event: MouseEvent) => {
      dragging = true
      sliderDown.call(slider, event)
    }
    list.onMouse = (event: MouseEvent) => {
      if (!dragging) return
      if (event.type === "drag") {
        sliderDrag.call(slider, event)
      } else if (event.type === "up") {
        dragging = false
        sliderUp.call(slider, event)
      } else if (event.type === "down" && event.target !== slider) {
        dragging = false
      }
    }
  }

  private listRow(
    id: string,
    isSelected: () => boolean,
    onSelect: () => void,
    onScroll: (amount: number) => void,
  ): BoxRenderable {
    const row = new BoxRenderable(this.renderer, {
      id,
      width: "100%",
      height: 1,
      flexDirection: "row",
      backgroundColor: isSelected() ? COLORS.selected : COLORS.panel,
      onMouseDown: (event) => {
        event.stopPropagation()
        this.search.blur()
        onSelect()
      },
      onMouseOver: () => {
        if (!isSelected()) row.backgroundColor = COLORS.panelAlt
      },
      onMouseOut: () => {
        if (!isSelected()) row.backgroundColor = COLORS.panel
      },
      onMouseScroll: (event) => {
        const direction = event.scroll?.direction
        if (direction !== "up" && direction !== "down") return
        event.stopPropagation()
        const distance = Math.max(1, Math.round(event.scroll?.delta ?? 1))
        onScroll(direction === "down" ? distance : -distance)
      },
    })
    return row
  }

  // ---- tabs ----

  private showTab(tab: Tab): void {
    this.activeTab = tab
    this.search.blur()
    this.skillsView.visible = tab === "skills"
    this.benchView.visible = tab === "bench"
    if (tab !== "bench") this.toggleHelp(false)
    this.updateTabChrome()
  }

  private toggleHelp(force?: boolean): void {
    this.help.visible = force ?? !this.help.visible
  }

  private updateTabChrome(): void {
    for (const [tab, parts] of Object.entries(this.tabButtons) as [Tab, ButtonParts][]) {
      const active = tab === this.activeTab
      parts.box.backgroundColor = active ? COLORS.selected : COLORS.panelAlt
      parts.label.fg = active ? COLORS.accent : COLORS.text
    }
    this.shortcuts.content =
      this.activeTab === "skills"
        ? "/ search   ↑↓ move   M mark   C Claude   X Codex   Space both   F status   G category   Ctrl-S/R/P   Tab benchmarks   Q quit"
        : "↑↓ move   [ ] switch run   ? columns   Tab skills   Q quit"
    this.updateSummary()
  }

  // ---- skills tab ----

  private applyFilters(preserveScroll = false): void {
    this.filtered = filterSkills(
      this.catalogData.skills,
      this.query,
      this.statusFilter,
      this.categoryFilter,
    )
    this.retainVisibleMarks()
    if (!this.selectedKey || !this.filtered.some((skill) => skill.key === this.selectedKey)) {
      this.selectedKey = this.filtered[0]?.key ?? null
    }
    this.rebuildRows(preserveScroll)
    this.updateFilterLabels()
    this.updateSummary()
    this.updateDetail()
  }

  private retainVisibleMarks(): void {
    const visible = new Set(this.filtered.map((skill) => skill.key))
    for (const key of this.markedKeys) {
      if (!visible.has(key)) this.markedKeys.delete(key)
    }
  }

  private rebuildRows(preserveScroll = false): void {
    const previousScrollTop = this.list.scrollTop
    for (const row of this.rows) row.destroyRecursively()
    this.rows = []
    this.rowByKey.clear()
    this.markCellByKey.clear()

    for (const skill of this.filtered) {
      const row = this.listRow(
        `skill-${skill.key}`,
        () => skill.key === this.selectedKey,
        () => this.selectKey(skill.key),
        (amount) => this.moveSelection(amount),
      )
      const markCell = this.tableCell(
        `mark-${skill.key}`,
        this.markedKeys.has(skill.key) ? "[x]" : "[ ]",
        this.markedKeys.has(skill.key) ? COLORS.accent : COLORS.muted,
        undefined,
        undefined,
        MARK_COLUMN_WIDTH,
      )
      row.add(markCell)
      const markLabel = markCell.findDescendantById(`mark-${skill.key}-label`)
      if (markLabel) this.markCellByKey.set(skill.key, markLabel as TextRenderable)
      row.add(
        this.tableCell(`name-${skill.key}`, skill.name, stateColor(skill), NAME_COLUMN_GROW, NAME_COLUMN_MIN_WIDTH, undefined, 2),
      )
      row.add(
        this.tableCell(`category-${skill.key}`, skill.category, COLORS.muted, CATEGORY_COLUMN_GROW, CATEGORY_COLUMN_MIN_WIDTH),
      )
      row.add(this.productCell(skill, "claude", PRODUCT_COLUMN_WIDTH))
      row.add(this.productCell(skill, "codex", PRODUCT_COLUMN_WIDTH))
      this.list.add(row)
      this.rows.push(row)
      this.rowByKey.set(skill.key, row)
    }
    this.list.scrollTo(preserveScroll ? previousScrollTop : 0)
  }

  private productCell(skill: SkillRecord, product: Exclude<Product, "both">, width: number): BoxRenderable {
    const enabled = product === "claude" ? skill.claude_enabled : skill.codex_enabled
    const box = new BoxRenderable(this.renderer, {
      id: `${product}-${skill.key}`,
      width,
      height: 1,
      paddingLeft: 1,
      paddingRight: 1,
      backgroundColor: "transparent",
      onMouseDown: (event) => {
        event.stopPropagation()
        this.search.blur()
        this.selectKey(skill.key)
        void this.toggleProduct(product, skill.key)
      },
      onMouseOver: () => {
        box.backgroundColor = COLORS.selected
      },
      onMouseOut: () => {
        box.backgroundColor = "transparent"
      },
    })
    box.add(this.cellText(`${product}-${skill.key}-label`, productLabel(enabled), "100%", productColor(enabled)))
    return box
  }

  private selectKey(key: string): void {
    const previous = this.selectedKey
    this.selectedKey = key
    if (previous) {
      const previousRow = this.rowByKey.get(previous)
      if (previousRow) previousRow.backgroundColor = COLORS.panel
    }
    const row = this.rowByKey.get(key)
    if (row) row.backgroundColor = COLORS.selected
    this.updateDetail()
  }

  private updateDetail(): void {
    const skill = this.catalogData.skills.find((candidate) => candidate.key === this.selectedKey)
    if (!skill) {
      this.detail.content = "No skills match the active filters."
      return
    }
    this.detail.content = [
      skill.name,
      "",
      `Category  ${skill.category}`,
      `State     ${skill.state}`,
      `Claude    ${productLabel(skill.claude_enabled)}`,
      `Codex     ${productLabel(skill.codex_enabled)}`,
      "",
      skill.description,
      "",
      skill.directory,
      skill.error ? `\nError: ${skill.error}` : "",
    ].join("\n")
  }

  private updateSummary(): void {
    if (this.activeTab === "bench") {
      const runs = this.runIds.length
      const latest = this.runIds.at(-1)
      this.summary.content = runs
        ? `${this.benchmarkedSkills.length} skills under eval   ${runs} run${runs === 1 ? "" : "s"}   latest ${latest}`
        : `${this.benchmarkedSkills.length} skills under eval   no saved runs`
      return
    }
    const total = this.catalogData.skills.length
    const enabled = this.catalogData.skills.filter((skill) => skill.state === "enabled").length
    const disabled = this.catalogData.skills.filter((skill) => skill.state === "disabled").length
    const mixed = this.catalogData.skills.filter((skill) => skill.state === "mixed").length
    this.summary.content = `${this.filtered.length}/${total} shown   ${enabled} enabled   ${disabled} disabled   ${mixed} mixed   ${this.markedKeys.size} marked`
  }

  private updateFilterLabels(): void {
    this.statusButton.label.content = ` Status: ${this.statusFilter}`
    this.categoryButton.label.content = ` Category: ${this.categoryFilter}`
  }

  private cycleStatus(direction: number): void {
    this.search.blur()
    const index = STATUS_FILTERS.indexOf(this.statusFilter)
    this.statusFilter = STATUS_FILTERS[(index + direction + STATUS_FILTERS.length) % STATUS_FILTERS.length]
    this.applyFilters()
  }

  private cycleCategory(direction: number): void {
    this.search.blur()
    const index = Math.max(0, this.categories.indexOf(this.categoryFilter))
    this.categoryFilter = this.categories[(index + direction + this.categories.length) % this.categories.length]
    this.applyFilters()
  }

  private resetFilters(): void {
    this.search.blur()
    this.statusFilter = "all"
    this.categoryFilter = "all"
    this.applyFilters()
    this.setMessage("Filters reset")
  }

  private moveSelection(amount: number): void {
    if (this.filtered.length === 0) return
    const current = this.filtered.findIndex((skill) => skill.key === this.selectedKey)
    const next = Math.max(0, Math.min(this.filtered.length - 1, (current < 0 ? 0 : current) + amount))
    const skill = this.filtered[next]
    this.selectKey(skill.key)
    this.list.scrollChildIntoView(`skill-${skill.key}`)
  }

  private selectedSkill(): SkillRecord | undefined {
    return this.catalogData.skills.find((skill) => skill.key === this.selectedKey)
  }

  private toggleMark(): void {
    const skill = this.selectedSkill()
    if (!skill || skill.error) {
      this.setMessage(skill?.error || "Cannot mark this skill")
      return
    }
    if (this.markedKeys.has(skill.key)) this.markedKeys.delete(skill.key)
    else this.markedKeys.add(skill.key)
    // update the cell in place; a rebuild would reset the scroll position
    const markLabel = this.markCellByKey.get(skill.key)
    if (markLabel) {
      const marked = this.markedKeys.has(skill.key)
      markLabel.content = marked ? "[x]" : "[ ]"
      markLabel.fg = marked ? COLORS.accent : COLORS.muted
    }
    this.updateSummary()
  }

  private toggleTargets(): SkillRecord[] {
    const keys =
      this.markedKeys.size > 0
        ? this.markedKeys
        : new Set(this.selectedKey ? [this.selectedKey] : [])
    return this.catalogData.skills.filter((skill) => keys.has(skill.key) && !skill.error)
  }

  private productIsEnabled(skill: SkillRecord, product: Product): boolean {
    if (product === "both") {
      return skill.claude_enabled === true && skill.codex_enabled === true
    }
    return product === "claude"
      ? skill.claude_enabled === true
      : skill.codex_enabled === true
  }

  private async toggleProduct(product: Product, singleKey?: string): Promise<void> {
    if (this.busy) return
    const targets = singleKey
      ? this.catalogData.skills.filter((skill) => skill.key === singleKey && !skill.error)
      : this.toggleTargets()
    if (targets.length === 0) {
      const selected = this.selectedSkill()
      this.setMessage(selected?.error || "No changeable skills selected")
      return
    }
    const enabled = !targets.every((skill) => this.productIsEnabled(skill, product))
    const keys = targets.map((skill) => skill.key)
    const noun = keys.length === 1 ? "skill" : "skills"
    this.busy = true
    this.setMessage(`Updating ${keys.length} ${noun} for ${product}…`)
    try {
      await this.backend.setProducts(keys, product, enabled)
      await this.refreshCatalog()
      this.setMessage(`${product} ${enabled ? "enabled" : "disabled"} for ${keys.length} ${noun}`)
    } catch (error) {
      this.setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.busy = false
    }
  }

  private async refreshCatalog(): Promise<void> {
    this.catalogData = await this.backend.catalog()
    this.categories = ["all", ...this.catalogData.categories]
    if (!this.categories.includes(this.categoryFilter)) this.categoryFilter = "all"
    this.applyFilters(true)
  }

  private async saveSnapshot(): Promise<void> {
    if (this.busy) return
    this.busy = true
    this.setMessage("Saving invocation states…")
    try {
      this.setMessage(await this.backend.saveSnapshot())
    } catch (error) {
      this.setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.busy = false
    }
  }

  private async loadSnapshot(): Promise<void> {
    if (this.busy) return
    this.busy = true
    this.setMessage("Reloading saved invocation states…")
    try {
      this.setMessage(await this.backend.loadSnapshot())
      await this.refreshCatalog()
    } catch (error) {
      this.setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.busy = false
    }
  }

  private async armOrReset(): Promise<void> {
    const now = Date.now()
    if (now - this.resetArmedAt > 5_000) {
      this.resetArmedAt = now
      this.setMessage("Pre-commit reset armed: click Activate all or press Ctrl-P again within 5 seconds")
      return
    }
    if (this.busy) return
    this.resetArmedAt = 0
    this.busy = true
    this.setMessage("Saving current state and activating every skill for both products…")
    try {
      this.setMessage(await this.backend.preCommitReset())
      await this.refreshCatalog()
    } catch (error) {
      this.setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.busy = false
    }
  }

  // ---- benchmarks tab ----

  private async loadBench(announce = false): Promise<void> {
    if (!this.evalSource) {
      this.benchError = "No eval source configured."
      this.rebuildBenchRows()
      return
    }
    try {
      const [skills, runIds] = await Promise.all([this.evalSource.benchmarkedSkills(), this.evalSource.runIds()])
      this.benchmarkedSkills = skills
      this.runIds = runIds
      const current = this.run?.runId
      const keep = current ? runIds.indexOf(current) : -1
      this.runIndex = keep >= 0 ? keep : runIds.length - 1
      this.run = this.runIndex >= 0 ? await this.evalSource.loadRun(runIds[this.runIndex]) : null
      this.benchError = null
      if (announce) this.setMessage(`Loaded ${runIds.length} run${runIds.length === 1 ? "" : "s"}`)
    } catch (error) {
      this.benchError = error instanceof Error ? error.message : String(error)
      this.setMessage(`Error: ${this.benchError}`)
    }
    this.benchItems = buildBenchItems(this.run, this.benchmarkedSkills)
    if (!this.benchSelectedKey || !this.benchItems.some((item) => item.key === this.benchSelectedKey)) {
      this.benchSelectedKey = this.benchItems[0]?.key ?? null
    }
    this.rebuildBenchRows()
    this.updateSummary()
  }

  private async cycleRun(direction: number): Promise<void> {
    if (!this.evalSource || this.runIds.length === 0) return
    const next = (this.runIndex + direction + this.runIds.length) % this.runIds.length
    if (next === this.runIndex) return
    try {
      this.run = await this.evalSource.loadRun(this.runIds[next])
      this.runIndex = next
      this.benchError = null
    } catch (error) {
      this.benchError = error instanceof Error ? error.message : String(error)
      this.setMessage(`Error: ${this.benchError}`)
    }
    this.benchItems = buildBenchItems(this.run, this.benchmarkedSkills)
    if (!this.benchSelectedKey || !this.benchItems.some((item) => item.key === this.benchSelectedKey)) {
      this.benchSelectedKey = this.benchItems[0]?.key ?? null
    }
    this.rebuildBenchRows()
    this.updateSummary()
  }

  private benchCells(
    prefix: string,
    text: Record<"skill" | "task" | "model" | "gate" | "subset" | "full" | "dSubset" | "dFull", string>,
    colors?: Partial<Record<keyof typeof text, string>>,
  ): BoxRenderable[] {
    const color = (field: keyof typeof text) => colors?.[field] ?? COLORS.muted
    return [
      this.tableCell(`${prefix}-skill`, text.skill, color("skill"), BENCH_SKILL_GROW, BENCH_TEXT_MIN_WIDTH, undefined, 2),
      this.tableCell(`${prefix}-task`, text.task, color("task"), BENCH_TEXT_GROW, BENCH_TEXT_MIN_WIDTH),
      this.tableCell(`${prefix}-model`, text.model, color("model"), BENCH_MODEL_GROW, BENCH_MODEL_MIN_WIDTH),
      this.tableCell(`${prefix}-gate`, text.gate, color("gate"), undefined, undefined, BENCH_GATE_WIDTH),
      this.tableCell(`${prefix}-subset`, text.subset, color("subset"), undefined, undefined, BENCH_PCT_WIDTH),
      this.tableCell(`${prefix}-full`, text.full, color("full"), undefined, undefined, BENCH_PCT_WIDTH),
      this.tableCell(`${prefix}-dsubset`, text.dSubset, color("dSubset"), undefined, undefined, BENCH_DELTA_WIDTH),
      this.tableCell(`${prefix}-dfull`, text.dFull, color("dFull"), undefined, undefined, BENCH_DELTA_WIDTH),
    ]
  }

  private rebuildBenchRows(): void {
    for (const row of this.benchRows) row.destroyRecursively()
    this.benchRows = []
    this.benchRowByKey.clear()
    this.benchRunButton.label.content = ` ${this.run ? `${this.run.runId}  (${this.runIndex + 1}/${this.runIds.length})` : "no saved runs"}`

    for (const item of this.benchItems) {
      const row = this.listRow(
        `bench-${item.key}`,
        () => item.key === this.benchSelectedKey,
        () => this.selectBench(item.key),
        (amount) => this.moveBenchSelection(amount),
      )
      const r = item.row
      const dSubset = r ? delta(r.baseline, r.withSkill, "subset") : "-"
      const dFull = r ? delta(r.baseline, r.withSkill, "full") : "-"
      const cells = this.benchCells(
        `bench-cell-${item.key}`,
        {
          skill: item.skill,
          task: item.task,
          model: r ? modelName(r.model) : "-",
          gate: r ? (r.withSkill ? `${gate(r.baseline)}|${gate(r.withSkill)}` : gate(r.baseline)) : "no run",
          subset: r ? pctPair(r.baseline, r.withSkill, "subset") : "-",
          full: r ? pctPair(r.baseline, r.withSkill, "full") : "-",
          dSubset,
          dFull,
        },
        {
          skill: r ? COLORS.text : COLORS.muted,
          task: COLORS.text,
          model: COLORS.muted,
          gate: r && r.withSkill && r.withSkill.ok === 0 ? COLORS.disabled : COLORS.text,
          subset: COLORS.text,
          full: COLORS.text,
          dSubset: deltaColor(dSubset),
          dFull: deltaColor(dFull),
        },
      )
      for (const cell of cells) row.add(cell)
      this.benchList.add(row)
      this.benchRows.push(row)
      this.benchRowByKey.set(item.key, row)
    }
    this.benchList.scrollTo(0)
    this.updateBenchDetail()
  }

  private selectBench(key: string): void {
    const previous = this.benchSelectedKey
    this.benchSelectedKey = key
    if (previous) {
      const previousRow = this.benchRowByKey.get(previous)
      if (previousRow) previousRow.backgroundColor = COLORS.panel
    }
    const row = this.benchRowByKey.get(key)
    if (row) row.backgroundColor = COLORS.selected
    this.updateBenchDetail()
  }

  private moveBenchSelection(amount: number): void {
    if (this.benchItems.length === 0) return
    const current = this.benchItems.findIndex((item) => item.key === this.benchSelectedKey)
    const next = Math.max(0, Math.min(this.benchItems.length - 1, (current < 0 ? 0 : current) + amount))
    const item = this.benchItems[next]
    this.selectBench(item.key)
    this.benchList.scrollChildIntoView(`bench-${item.key}`)
  }

  private updateBenchDetail(): void {
    if (this.benchError) {
      this.benchDetail.content = `Error reading eval results:\n${this.benchError}`
      return
    }
    const item = this.benchItems.find((candidate) => candidate.key === this.benchSelectedKey)
    if (!item) {
      this.benchDetail.content = this.run
        ? "This run has no rows."
        : "No saved runs.\n\nRun ./run-eval.sh from the vault root, then Refresh."
      return
    }
    const run = this.run
    if (!item.row || !run) {
      const info = run?.skills[item.skill]
      this.benchDetail.content = [
        item.skill,
        "",
        run ? `Not in run ${run.runId}.` : "No saved runs yet.",
        info ? `injection ${info.injection}` : "",
        "",
        "Pair it with a task in eval/src/config.ts and run ./run-eval.sh.",
      ].join("\n")
      return
    }
    const r = item.row
    const b = r.baseline
    const s = r.withSkill
    const col = (value: string) => value.padEnd(11)
    const line = (label: string, base: string, skill: string, extra = "") =>
      `${label.padEnd(16)}${col(base)}${s ? col(skill) : ""}${extra}`
    const bench = (stats: ArmStats | null, field: "ns" | "bytes" | "allocs") => (stats?.bench ? num(stats.bench[field]) : "-")
    const info = run.skills[item.skill]
    const hash = run.provenance[`skill:${item.skill}`]
    const lines = [
      s ? `${item.skill} on ${item.task}` : `${item.task} (baseline only)`,
      `${r.model}   run ${run.runId}`,
      `config ${run.configId}   reps ${run.reps}   cells ${run.cells}`,
      "",
      line("", "baseline", "skill"),
      line("n", String(b.n), s ? String(s.n) : ""),
      line("gate ok/gated", gate(b), s ? gate(s) : ""),
      line("trunc / err", `${b.empty}/${b.errors}`, s ? `${s.empty}/${s.errors}` : ""),
      line("skill%", pct(b.subset), s ? pct(s.subset) : "", s ? `Δ ${delta(b, s, "subset")}` : ""),
      line("full%", pct(b.full), s ? pct(s.full) : "", s ? `Δ ${delta(b, s, "full")}` : ""),
      line("think (median)", num(b.reasoning), s ? num(s.reasoning) : ""),
      line("tool calls", num(b.toolCalls), s ? num(s.toolCalls) : ""),
      "",
      line("bench ns/op", bench(b, "ns"), bench(s, "ns")),
      line("bench B/op", bench(b, "bytes"), bench(s, "bytes")),
      line("bench allocs/op", bench(b, "allocs"), bench(s, "allocs")),
      line("bench failed", String(b.benchFailures), s ? String(s.benchFailures) : ""),
      "",
      info ? `injection ${info.injection}${info.version ? `   version ${info.version}` : ""}` : "",
      hash ? `skill dir hash ${hash}` : "",
      run.startedAt ? `started ${run.startedAt}` : "",
    ]
    this.benchDetail.content = lines.filter((text, index) => text !== "" || lines[index - 1] !== "").join("\n")
  }

  private setMessage(value: string): void {
    this.message.content = value
  }

  private readonly handleKey = (key: KeyEvent): void => {
    if (key.eventType === "release") return
    if (key.ctrl && key.name === "s") {
      void this.saveSnapshot()
      return
    }
    if (key.ctrl && key.name === "r") {
      void this.loadSnapshot()
      return
    }
    if (key.ctrl && key.name === "p") {
      void this.armOrReset()
      return
    }

    const searchFocused = this.renderer.currentFocusedRenderable === this.search
    if (key.name === "tab") {
      this.showTab(this.activeTab === "skills" ? "bench" : "skills")
      return
    }
    if (searchFocused) {
      if (key.name === "escape" || key.name === "return") this.search.blur()
      return
    }
    if (key.name === "1") {
      this.showTab("skills")
      return
    }
    if (key.name === "2") {
      this.showTab("bench")
      return
    }
    if (this.help.visible) {
      if (key.name === "?" || key.name === "escape" || key.name === "q") this.toggleHelp(false)
      return
    }
    if (key.name === "q" || key.name === "escape") {
      this.renderer.destroy()
      return
    }

    if (this.activeTab === "bench") {
      switch (key.name) {
        case "?":
          this.toggleHelp(true)
          return
        case "up":
        case "k":
          this.moveBenchSelection(-1)
          return
        case "down":
        case "j":
          this.moveBenchSelection(1)
          return
        case "pageup":
          this.moveBenchSelection(-10)
          return
        case "pagedown":
          this.moveBenchSelection(10)
          return
        case "home":
          this.moveBenchSelection(-this.benchItems.length)
          return
        case "end":
          this.moveBenchSelection(this.benchItems.length)
          return
        case "[":
          void this.cycleRun(-1)
          return
        case "]":
          void this.cycleRun(1)
          return
      }
      return
    }

    switch (key.name) {
      case "/":
        this.search.focus()
        return
      case "up":
      case "k":
        this.moveSelection(-1)
        return
      case "down":
      case "j":
        this.moveSelection(1)
        return
      case "pageup":
        this.moveSelection(-10)
        return
      case "pagedown":
        this.moveSelection(10)
        return
      case "home":
        this.moveSelection(-this.filtered.length)
        return
      case "end":
        this.moveSelection(this.filtered.length)
        return
      case "space": {
        void this.toggleProduct("both")
        return
      }
      case "c": {
        void this.toggleProduct("claude")
        return
      }
      case "x": {
        void this.toggleProduct("codex")
        return
      }
      case "m": {
        this.toggleMark()
        return
      }
      case "f":
        this.cycleStatus(key.shift ? -1 : 1)
        return
      case "g":
        this.cycleCategory(key.shift ? -1 : 1)
        return
    }
  }
}
