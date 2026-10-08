import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import ts from "typescript"

const module = { exports: {} }
const source = readFileSync(new URL("../src/lib/ytdlp/download-feedback.ts", import.meta.url), "utf8")
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module, exports: module.exports })
const { recoveryAction, estimatedTime, failureSummary } = module.exports

test("failed downloads offer recovery only for errors that the action can resolve", () => {
  for (const key of ["error.cookieAccess", "error.ageRestricted", "error.botCheck", "error.siteBlocked"]) {
    assert.equal(recoveryAction(key), "cookies")
  }
  for (const key of ["error.ytdlpNotFound", "error.ffmpegNotFound", "error.invalidOptions", "error.impersonateUnavailable"]) {
    assert.equal(recoveryAction(key), "dependencies")
  }
  assert.equal(recoveryAction("error.downloadPathUnavailable"), "directory")
  for (const key of [null, "error.privateVideo", "error.networkError", "error.downloadFailed", "an unexpected raw error"]) {
    assert.equal(recoveryAction(key), null)
  }
})

test("remaining time accepts estimates and avoids displaying unknown values as zero", () => {
  for (const value of [null, undefined, "", "NA", "Unknown", "--:--", "00:99"]) {
    assert.equal(estimatedTime(value), null)
  }
  assert.equal(estimatedTime(" 00:40 "), "00:40")
  assert.equal(estimatedTime("1:20:30"), "1:20:30")
  assert.equal(estimatedTime("00:00"), "00:00")
})

test("unknown errors get a translated summary instead of raw diagnostics", () => {
  const t = key => ({ "error.downloadFailed": "La descarga falló.", "error.cookieAccess": "No se puede acceder a las cookies." })[key] ?? key
  assert.equal(failureSummary("error.cookieAccess", t), "No se puede acceder a las cookies.")
  for (const key of [null, "error.futureError", "Traceback: an internal error"]) {
    assert.equal(failureSummary(key, t), "La descarga falló.")
  }
})
