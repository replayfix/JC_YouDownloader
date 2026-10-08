import { spawn, spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { createServer } from "node:net"
import { delimiter, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = { ...process.env }
const pathKey = Object.keys(env).find(key => key.toUpperCase() === "PATH") ?? "PATH"
const cargo = process.platform === "win32" ? "cargo.exe" : "cargo"

function prependPath(path) {
  env[pathKey] = `${path}${delimiter}${env[pathKey] ?? ""}`
}

function cargoAvailable() {
  return spawnSync(cargo, ["--version"], { env, windowsHide: true }).status === 0
}

// Prefer the terminal's Rust installation, then the standard rustup location.
if (!cargoAvailable()) {
  prependPath(join(env.CARGO_HOME || join(homedir(), ".cargo"), "bin"))
}

// Optional machine-specific paths stay out of the repository.
const localConfig = join(root, ".desktop.local.json")
if (!cargoAvailable() && existsSync(localConfig)) {
  try {
    const config = JSON.parse(readFileSync(localConfig, "utf8"))
    if (typeof config.cargoHome !== "string" || typeof config.rustupHome !== "string") {
      throw new Error("Se necesitan cargoHome y rustupHome.")
    }
    env.CARGO_HOME = config.cargoHome
    env.RUSTUP_HOME = config.rustupHome
    prependPath(join(env.CARGO_HOME, "bin"))
  } catch (error) {
    console.error(`No se pudo leer .desktop.local.json: ${error.message}`)
    process.exit(1)
  }
}

if (!cargoAvailable()) {
  console.error("No se encontró Rust. Instala Rust con rustup y vuelve a abrir la terminal, o configura .desktop.local.json.")
  process.exit(1)
}

const cli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js")
if (!existsSync(cli)) {
  console.error("Faltan las dependencias. Ejecuta npm ci --ignore-scripts primero.")
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  const help = spawnSync(process.execPath, [cli, "dev", "--help"], { cwd: root, env, stdio: "inherit" })
  process.exit(help.status ?? 1)
}

const fetched = spawnSync(process.execPath, [join(root, "scripts", "fetch-binaries.mjs")], {
  cwd: root, env, stdio: "inherit",
})
if (fetched.status !== 0) process.exit(fetched.status ?? 1)

// Allocate a free port instead of colliding with an older development session.
const port = await new Promise((resolve, reject) => {
  const server = createServer()
  server.once("error", reject)
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port
    server.close(error => error ? reject(error) : resolve(port))
  })
})
const url = `http://127.0.0.1:${port}`
console.log(`Iniciando JC_YouDownloader en modo desarrollo (${url}). Para detenerlo: Ctrl+C.`)

const workers = []
let stopping = false
let exitCode = 0
let cleanupTimer

function running(child) {
  return child.exitCode === null && child.signalCode === null
}

function finishIfStopped() {
  if (stopping && workers.every(child => !running(child))) {
    clearTimeout(cleanupTimer)
    process.exit(exitCode)
  }
}

function shutdown(code) {
  if (stopping) return
  stopping = true
  exitCode = code
  for (const child of workers) {
    if (running(child) && process.platform !== "win32") child.kill("SIGINT")
  }
  // Windows forwards Ctrl+C through the console. Give Tauri time to shut down
  // gracefully, then clean up only the process trees started by this command.
  cleanupTimer = setTimeout(() => {
    for (const child of workers) {
      if (!running(child)) continue
      if (process.platform === "win32") {
        spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true, stdio: "ignore",
        })
      } else child.kill("SIGKILL")
    }
    process.exit(exitCode)
  }, 2000)
  finishIfStopped()
}

function start(commandArgs) {
  const child = spawn(process.execPath, commandArgs, { cwd: root, env, stdio: "inherit" })
  workers.push(child)
  child.once("error", error => {
    console.error(`No se pudo iniciar la aplicación: ${error.message}`)
    shutdown(1)
  })
  child.once("exit", code => {
    if (!stopping) shutdown(code ?? 1)
    finishIfStopped()
  })
}

process.on("SIGINT", () => shutdown(130))
process.on("SIGTERM", () => shutdown(143))
start([join(root, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port)])
start([
  cli, "dev", "--config", join(root, "src-tauri", "tauri.dev.conf.json"),
  "--config", JSON.stringify({ build: { devUrl: url } }), ...args,
])
