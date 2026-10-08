import { spawnSync } from "node:child_process"
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function nextRelease(current, tags, requested = "") {
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
  const valid = version => pattern.test(version) && version.split(".").every(part => Number.isSafeInteger(Number(part)))
  if (!valid(current)) throw new Error("La versión actual no es válida")
  const compare = (a, b) => {
    const left = a.split(".").map(Number), right = b.split(".").map(Number)
    for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i]
    return 0
  }
  const published = tags.map(tag => tag.replace(/^v/, "")).filter(valid)
  const latest = [current, ...published].sort(compare).at(-1)
  const parts = latest.split(".").map(Number)
  parts[2]++
  const version = requested.trim() || parts.join(".")
  if (!valid(version) || compare(version, latest) <= 0) throw new Error("La nueva versión debe ser mayor que la actual y las publicadas")
  return version
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..")
  const configPath = join(root, "src-tauri", "tauri.conf.json")
  const config = JSON.parse(readFileSync(configPath, "utf8"))
  const result = spawnSync("git", ["tag", "-l", "v*"], { cwd: root, encoding: "utf8" })
  if (result.status !== 0) throw new Error("No se pudieron leer las versiones publicadas")
  const version = nextRelease(config.version, result.stdout.trim().split(/\r?\n/), process.env.RELEASE_VERSION_INPUT)
  config.version = version
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
  for (const name of ["package.json", "package-lock.json"]) {
    const path = join(root, name), data = JSON.parse(readFileSync(path, "utf8"))
    data.version = version
    if (data.packages?.[""]) data.packages[""].version = version
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n")
  }
  const cargoPath = join(root, "src-tauri", "Cargo.toml")
  writeFileSync(cargoPath, readFileSync(cargoPath, "utf8").replace(/^version = ".*"/m, `version = "${version}"`))
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`)
  console.log(`Versión preparada: ${version}`)
}
