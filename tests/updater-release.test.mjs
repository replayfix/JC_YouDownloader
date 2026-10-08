import assert from "node:assert/strict"
import { test } from "node:test"
import { nextRelease } from "../scripts/prepare-release.mjs"
import { createManifest } from "../scripts/create-update-manifest.mjs"

test("first release is newer than the app even without Git tags", () => {
  assert.equal(nextRelease("0.1.0", []), "0.1.1")
  assert.equal(nextRelease("0.1.0", ["v0.1.9", "dev", "v0.1.10"]), "0.1.11")
  assert.equal(nextRelease("0.1.0", ["v0.1.9"], "1.0.0"), "1.0.0")
  for (const version of ["0.1.0", "0.0.9", "invalid", "0.1.01"]) {
    assert.throws(() => nextRelease("0.1.0", [], version))
  }
})

test("portable manifest points to the signed ZIP in the correct GitHub release", () => {
  const manifest = createManifest("0.1.1", "JC Downloader_portable.zip", "signed ZIP", "replayfix/YouDownloader")
  assert.equal(manifest.platforms["windows-x86_64"].url, "https://github.com/replayfix/YouDownloader/releases/download/v0.1.1/JC%20Downloader_portable.zip")
  assert.equal(manifest.platforms["windows-x86_64"].signature, "signed ZIP")
  assert.throws(() => createManifest("0.1.1", "setup.exe", "signed", "replayfix/YouDownloader"))
  assert.throws(() => createManifest("0.1.1", "portable.zip", "", "replayfix/YouDownloader"))
  assert.throws(() => createManifest("0.1.1", "../portable.zip", "signed", "replayfix/YouDownloader"))
})
