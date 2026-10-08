import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const mark = readFileSync(join(root, "src/lib/assets/brand-mark.svg"), "utf8")
// Reduce native-icon padding without changing the brand's proportions.
const icon = mark.replace('fill="currentColor"', 'fill="#000000"')
  .replace('viewBox="0 0 512 512"', 'viewBox="40 40 432 432"')
const source = join(root, "src-tauri/app-icon.svg")
writeFileSync(source, icon)
const result = spawnSync(process.execPath, [
  join(root, "node_modules/@tauri-apps/cli/tauri.js"), "icon", source,
  "--output", join(root, "src-tauri/icons"), "--ios-color", "#ffffff",
], { cwd: root, stdio: "inherit" })
if (result.status !== 0) process.exit(result.status ?? 1)
// Include exact taskbar sizes for 100%, 125%, 150%, and 200% scaling.
// Each ICO frame is rendered directly from SVG, avoiding bitmap resampling.
const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
const temporary = mkdtempSync(join(tmpdir(), "jc-brand-icons-"))
try {
  const frames = spawnSync(process.execPath, [
    join(root, "node_modules/@tauri-apps/cli/tauri.js"), "icon", source,
    "--output", temporary, ...sizes.flatMap(size => ["--png", String(size)]),
  ], { cwd: root, stdio: "inherit" })
  if (frames.status !== 0) throw new Error("Could not render Windows icon frames")
  const images = sizes.map(size => readFileSync(join(temporary, size + "x" + size + ".png")))
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16
    header[entry] = header[entry + 1] = size === 256 ? 0 : size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(images[index].length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += images[index].length
  })
  writeFileSync(join(root, "src-tauri/icons/icon.ico"), Buffer.concat([header, ...images]))
} finally {
  if (resolve(dirname(temporary)) !== resolve(tmpdir())) throw new Error("Invalid temporary directory")
  rmSync(temporary, { recursive: true, force: true })
}
cpSync(join(root, "src-tauri/icons/icon.png"), join(root, "static/AppIcon.png"))
cpSync(join(root, "src-tauri/icons/32x32.png"), join(root, "static/favicon.png"))
console.log("Brand icons regenerated from brand-mark.svg")
