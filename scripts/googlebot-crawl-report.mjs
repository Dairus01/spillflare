import { promises as dns } from "node:dns";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import readline from "node:readline";
import path from "node:path";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const logPaths = args.filter((arg) => !arg.startsWith("--"));
if (!logPaths.length) logPaths.push("/var/log/nginx/access.log");
const cachePath = path.join(process.cwd(), ".googlebot-dns-cache.json");
let cache = {};
try { cache = JSON.parse(await readFile(cachePath, "utf8")); } catch {}
const now = Date.now();

async function verifiedGoogleIp(ip) {
  const known = cache[ip];
  if (known && now - known.checkedAt < 7 * 86400_000) return known.verified;
  let verified = false;
  try {
    const hosts = await dns.reverse(ip);
    for (const host of hosts.filter((name) => /(?:\.googlebot\.com|\.google\.com)\.?$/i.test(name))) {
      const forward = await dns.lookup(host, { all: true });
      if (forward.some((answer) => answer.address === ip)) { verified = true; break; }
    }
  } catch {}
  cache[ip] = { verified, checkedAt: now };
  return verified;
}

async function lines(file) {
  const stream = createReadStream(file);
  return readline.createInterface({ input: file.endsWith(".gz") ? stream.pipe(createGunzip()) : stream, crlfDelay: Infinity });
}

const candidates = [];
const combined = /^(\S+) \S+ \S+ \[([^\]]+)] "(\S+) ([^ ]+) [^"]+" (\d{3}) (\d+|-) "[^"]*" "([^"]*)"(?: .*?([0-9.]+))?$/;
for (const file of logPaths) {
  try {
    for await (const line of await lines(file)) {
      const match = line.match(combined);
      if (match && /Googlebot/i.test(match[7])) candidates.push({ ip: match[1], timestamp: match[2], method: match[3], url: match[4], status: Number(match[5]), bytes: Number(match[6]) || 0, requestTime: match[8] ? Number(match[8]) : null });
    }
  } catch (error) { if (!jsonOutput) console.warn(`Could not read ${file}: ${error.message}`); }
}
const verification = new Map();
await Promise.all([...new Set(candidates.map((row) => row.ip))].map(async (ip) => verification.set(ip, await verifiedGoogleIp(ip))));
await writeFile(cachePath, JSON.stringify(cache, null, 2), { mode: 0o600 });
const rows = candidates.filter((row) => verification.get(row.ip));
const countBy = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
const day = (timestamp) => { const [date] = timestamp.split(":"); const [d, mon, y] = date.split("/"); return `${y}-${mon}-${d}`; };
const group = (url) => /^\/oil-spills\/\d+/.test(url) ? "incident" : /^\/places\/states\//.test(url) ? "state" : /^\/(?:oil-spills|gas-flares|places)(?:\/|$)/.test(url) ? "hub" : "other";
const timed = rows.filter((row) => row.requestTime !== null);
const report = {
  verifiedRequests: rows.length,
  rejectedUserAgentOnlyRequests: candidates.length - rows.length,
  requestsPerDay: countBy(rows.map((row) => day(row.timestamp))),
  uniqueUrls: new Set(rows.map((row) => row.url.split("?")[0])).size,
  uniqueIncidentPages: new Set(rows.filter((row) => group(row.url) === "incident").map((row) => row.url.split("?")[0])).size,
  hubRequests: rows.filter((row) => group(row.url) === "hub").length,
  stateRequests: rows.filter((row) => group(row.url) === "state").length,
  statusDistribution: countBy(rows.map((row) => `${Math.floor(row.status / 100)}xx`)),
  averageResponseSeconds: timed.length ? timed.reduce((sum, row) => sum + row.requestTime, 0) / timed.length : null,
  mostCrawledRoutes: Object.entries(countBy(rows.map((row) => row.url.split("?")[0]))).slice(0, 20),
  routeGroups: countBy(rows.map((row) => group(row.url))),
  recentTimestamps: rows.slice(-20).map((row) => row.timestamp).reverse(),
  newUniqueUrlsPerDay: Object.fromEntries(Object.entries(rows.reduce((map, row) => { const key = day(row.timestamp); if (!map[key]) map[key] = new Set(); map[key].add(row.url.split("?")[0]); return map; }, {})).map(([key, set]) => [key, set.size])),
  note: timed.length ? undefined : "Average response time unavailable in the default Nginx combined format; use the optional timing log configuration.",
};
console.log(jsonOutput ? JSON.stringify(report) : JSON.stringify(report, null, 2));
