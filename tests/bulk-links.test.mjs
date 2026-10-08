import test from "node:test"
import assert from "node:assert/strict"
import { parseBulkLinks, decodeLinksFile } from "../src/lib/utils/bulk-links.js"

test("bulk links preserve order, remove repeated URLs and report invalid lines", () => {
  const result = parseBulkLinks("\uFEFF https://example.com/a \r\n\r\nhttps://example.com/a\nhttps://example.com/b?q=1\nnot a URL\nfile:///C:/test\nhttps://user:password@example.com/")
  assert.deepEqual(result.urls, ["https://example.com/a", "https://example.com/b?q=1"])
  assert.equal(result.duplicates, 1)
  assert.equal(result.invalid.length, 3)
})

test("Notepad files support UTF-8 and UTF-16 BOMs", () => {
  const text = "https://example.com/á\r\nhttps://example.com/b"
  assert.equal(decodeLinksFile(Buffer.from("\uFEFF" + text)), text)
  const le = Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, "utf16le")])
  assert.equal(decodeLinksFile(le), text)
  const be = Buffer.from(le)
  be.swap16()
  assert.equal(decodeLinksFile(be), text)
  assert.throws(() => decodeLinksFile(new Uint8Array([255])))
})
