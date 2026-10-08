import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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
console.log(`Portable folder: ${dest}`);
