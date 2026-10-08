import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.CARGO_TARGET_DIR
  ? resolve(root, process.env.CARGO_TARGET_DIR)
  : join(root, "src-tauri", "target");
const exe = join(target, "release", "jc-youdownloader.exe");
if (!existsSync(exe)) throw new Error("Compile the Windows release first.");
const dest = join(root, "portable");
mkdirSync(dest, { recursive: true });
cpSync(exe, join(dest, "JC_YouDownloader.exe"));
cpSync(join(root, "src-tauri", "binaries"), join(dest, "binaries"), { recursive: true });
writeFileSync(join(dest, "portable.flag"), "");
const config = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
writeFileSync(join(dest, ".portable-version.json"), JSON.stringify({ version: config.version }));
console.log(`Portable folder: ${dest}`);
