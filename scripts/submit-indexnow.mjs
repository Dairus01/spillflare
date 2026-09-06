const host = "spillflare.com.ng";
const key = "ff555e0637c84d7fb9d9e80b9739481c";
const pages = [
  "/",
  "/explore",
  "/oil-spills",
  "/oil-spills/analytics",
  "/oil-spills/causes",
  "/oil-spills/niger-delta",
  "/gas-flares",
  "/gas-flares/companies",
  "/places",
  "/search",
  "/data-and-methods",
  "/about",
  "/help",
  "/llms.txt",
  "/sitemap.xml",
].map((path) => `https://${host}${path}`);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: pages,
  }),
});

if (![200, 202].includes(response.status)) {
  throw new Error(`IndexNow rejected the submission: ${response.status} ${await response.text()}`);
}

console.log(`IndexNow accepted ${pages.length} URLs with status ${response.status}.`);
