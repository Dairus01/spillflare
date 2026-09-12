import { readFile } from "node:fs/promises";
import path from "node:path";

const host = "spillflare.com.ng";
// IndexNow ownership keys are public by protocol design. Support an environment
// override while ensuring neither value is written to logs.
const key = process.env.INDEXNOW_KEY || "ff555e0637c84d7fb9d9e80b9739481c";
let manifest;
try {
  manifest = JSON.parse(await readFile(process.env.INDEXNOW_MANIFEST || path.join(process.cwd(), "data", ".indexnow-changes.json"), "utf8"));
} catch {
  console.log("No IndexNow change manifest; nothing to submit.");
  process.exit(0);
}
const urls = [...new Set((manifest.paths ?? []).map((item) => new URL(item, `https://${host}`).href).filter((url) => new URL(url).hostname === host))];
if (!urls.length) {
  console.log("No changed URLs for IndexNow.");
  process.exit(0);
}

let accepted = 0;
for (let offset = 0; offset < urls.length; offset += 10_000) {
  const batch = urls.slice(offset, offset + 10_000);
  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: batch }),
    });
    if (![200, 202].includes(response.status)) throw new Error(`HTTP ${response.status}`);
    accepted += batch.length;
  } catch (error) {
    // Notification failures must never break authoritative snapshot refreshes.
    console.warn(`IndexNow batch failed safely: ${error.message}`);
  }
}
console.log(`IndexNow accepted ${accepted} of ${urls.length} changed URLs.`);
