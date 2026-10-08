// @ts-check
/** @param {string} text */
export function parseBulkLinks(text) {
  const urls = [], invalid = [], seen = new Set();
  let duplicates = 0;
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const parsed = new URL(line);
      if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      const normalized = parsed.href;
      if (seen.has(normalized)) { duplicates++; continue; }
      seen.add(normalized);
      urls.push(normalized);
    } catch { invalid.push(line); }
  }
  return { urls, invalid, duplicates };
}
/** @param {Uint8Array} bytes */
export function decodeLinksFile(bytes) {
  const encoding = bytes[0] === 255 && bytes[1] === 254 ? "utf-16le"
    : bytes[0] === 254 && bytes[1] === 255 ? "utf-16be" : "utf-8";
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}
