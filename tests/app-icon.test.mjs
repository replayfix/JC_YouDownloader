import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

test("Tauri receives a high-resolution first ICO frame instead of upscaling 16px", () => {
  const ico = readFileSync(new URL("../src-tauri/icons/icon.ico", import.meta.url))
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico[6], 0, "ICO encodes a 256px width as zero")
  assert.equal(ico[7], 0, "ICO encodes a 256px height as zero")
  const offset = ico.readUInt32LE(18)
  const png = ico.subarray(offset, offset + ico.readUInt32LE(14))
  assert.equal(png.readUInt32BE(16), 256)
  assert.equal(png.readUInt32BE(20), 256)
  assert.equal(png[25], 6, "The image must preserve RGBA transparency")
})
