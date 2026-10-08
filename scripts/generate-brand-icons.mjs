import { readFileSync, writeFileSync, cpSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const mark = readFileSync(join(root, "src/lib/assets/brand-mark.svg"), "utf8")
const icon = mark
  .replace('fill="currentColor"', 'fill="#ffffff"')
  .replace(/(<svg[^>]*>)/, '$1\n  <rect width="512" height="512" rx="88" fill="#007aff"/>')
const source = join(root, "src-tauri/app-icon.svg")
writeFileSync(source, icon)
const result = spawnSync(process.execPath, [
  join(root, "node_modules/@tauri-apps/cli/tauri.js"), "icon", source,
  "--output", join(root, "src-tauri/icons"), "--ios-color", "#007aff",
], { cwd: root, stdio: "inherit" })
if (result.status !== 0) process.exit(result.status ?? 1)
cpSync(join(root, "src-tauri/icons/icon.png"), join(root, "static/AppIcon.png"))
cpSync(join(root, "src-tauri/icons/32x32.png"), join(root, "static/favicon.png"))
console.log("Brand icons regenerated from brand-mark.svg")
