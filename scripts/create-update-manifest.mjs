import { readFileSync, writeFileSync } from "node:fs"
import { basename, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function createManifest(version, file, signature, repository, date = new Date().toISOString()) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Versión no válida")
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Repositorio no válido")
  if (!file.endsWith(".zip") || file !== basename(file) || file.includes("\\")) throw new Error("Se necesita un ZIP portable")
  if (!signature.trim()) throw new Error("Falta la firma del ZIP")
  return { version, notes: `JC_YouDownloader ${version}`, pub_date: date,
    platforms: { "windows-x86_64": { signature: signature.trim(),
      url: `https://github.com/${repository}/releases/download/v${version}/${encodeURIComponent(file)}` } } }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [version, zip, output = "latest.json"] = process.argv.slice(2)
  const manifest = createManifest(version, basename(zip), readFileSync(`${zip}.sig`, "utf8"), process.env.GITHUB_REPOSITORY || "replayfix/JC_YouDownloader")
  writeFileSync(output, JSON.stringify(manifest, null, 2) + "\n")
  console.log(`Manifiesto firmado preparado para ${version}`)
}
