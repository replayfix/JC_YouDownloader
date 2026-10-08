import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import { test } from "node:test"
import ts from "typescript"

const root = new URL("../src/lib/i18n/", import.meta.url)

function loadTs(file, extra = {}) {
  const module = { exports: {} }
  const source = readFileSync(file, "utf8")
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, ...extra }, {
    filename: fileURLToPath(file),
  })
  return module.exports
}

const en = loadTs(new URL("locales/en.ts", root)).default
const es = loadTs(new URL("locales/es.ts", root)).default

function i18n(systemLocale = "en-US") {
  const document = { documentElement: { lang: "en" } }
  const api = loadTs(new URL("index.svelte.ts", root), {
    $state: value => value,
    document,
    require: name => name === "@tauri-apps/plugin-os"
      ? { locale: async () => systemLocale }
      : loadTs(new URL(`${name}.ts`, root)),
  })
  return { api, document }
}

test("Spanish covers every English message and preserves interpolation parameters", () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort())
  for (const key of Object.keys(en)) {
    assert.ok(es[key].trim(), `Empty translation: ${key}`)
    const parameters = message => [...message.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    assert.deepEqual(parameters(es[key]), parameters(en[key]), `Parameters: ${key}`)
  }
})

test("Spanish can be selected without changing the English default", () => {
  const { api, document } = i18n()
  assert.equal(api.getLocale(), "en")
  assert.ok(api.supportedLocales.some(locale => locale.code === "es" && locale.name === "Español"))
  api.setLocale("es")
  assert.equal(api.t("nav.settings"), "Ajustes")
  assert.equal(api.t("download.best"), "Mejor calidad")
  assert.equal(api.t("layout.queueAdded", { count: 3 }), "Se añadieron 3 videos a la cola.")
  assert.equal(api.getDateLocale(), "es")
  assert.equal(document.documentElement.lang, "es")
  api.setLocale("en")
  assert.equal(api.t("nav.settings"), "Settings")
})

test("saved language takes priority over system language on the next launch", async () => {
  const { api } = i18n("en-US")
  await api.initLocale("es")
  assert.equal(api.getLocale(), "es")
  const english = i18n("es-CO").api
  await english.initLocale("en")
  assert.equal(english.getLocale(), "en")
})

test("system Spanish is detected when no language was selected", async () => {
  const { api } = i18n("es-CO")
  await api.initLocale()
  assert.equal(api.getLocale(), "es")
})
