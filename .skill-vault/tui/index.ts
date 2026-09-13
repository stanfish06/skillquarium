import { createCliRenderer } from "@opentui/core"
import { resolve } from "node:path"

import { SkillquariumApp } from "./app"
import { PythonSkillBackend } from "./backend"
import { FsEvalSource } from "./evalruns"

interface Options {
  root: string
  query: string
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    root: resolve(import.meta.dir, "../.."),
    query: "",
  }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--root") {
      const value = args[index + 1]
      if (!value) throw new Error("--root requires a path")
      options.root = resolve(value)
      index += 1
    } else if (argument.startsWith("--root=")) {
      options.root = resolve(argument.slice("--root=".length))
    } else if (argument === "--query") {
      const value = args[index + 1]
      if (value === undefined) throw new Error("--query requires text")
      options.query = value
      index += 1
    } else if (argument.startsWith("--query=")) {
      options.query = argument.slice("--query=".length)
    } else {
      throw new Error(`unknown TUI option: ${argument}`)
    }
  }
  return options
}

const options = parseArgs(Bun.argv.slice(2))
const backend = new PythonSkillBackend(options.root, resolve(import.meta.dir, "../skill_toggle.py"))
const catalog = await backend.catalog()
const renderer = await createCliRenderer({
  screenMode: "alternate-screen",
  exitOnCtrlC: true,
  useMouse: true,
  autoFocus: true,
  consoleMode: "disabled",
  backgroundColor: "#111318",
})

renderer.setTerminalTitle("Skillquarium")
new SkillquariumApp(renderer, backend, catalog, options.query, new FsEvalSource(resolve(options.root, "eval")))
