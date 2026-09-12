import { describe, expect, it } from "vitest";
import { buildSitemapGroups, sitemapIndexXml, sitemapXml } from "@/lib/sitemaps";

describe("sitemap architecture", () => {
  it("creates a non-empty index with unique HTTPS children", async () => {
    const groups = await buildSitemapGroups();
    expect(groups.length).toBeGreaterThan(5);
    expect(groups.every((group) => group.entries.length > 0)).toBe(true);
    expect(new Set(groups.map((group) => group.name)).size).toBe(groups.length);
    const xml = sitemapIndexXml(groups);
    expect(xml).toContain("https://spillflare.com.ng/sitemaps/core.xml");
    expect(xml).not.toMatch(/<loc>http:\/\//);
  });

  it("includes every URL once and never uses incident dates as lastmod", async () => {
    const groups = await buildSitemapGroups();
    const entries = groups.flatMap((group) => group.entries);
    expect(new Set(entries.map((item) => item.url)).size).toBe(entries.length);
    const incidentEntries = groups.filter((group) => group.name.startsWith("incidents-")).flatMap((group) => group.entries);
    expect(incidentEntries.length).toBeGreaterThan(20_000);
    expect(incidentEntries.every((item) => item.lastmod === undefined)).toBe(true);
    expect(sitemapXml(incidentEntries.slice(0, 2))).not.toContain("<lastmod>");
  });
});
