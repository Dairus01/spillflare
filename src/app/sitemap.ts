import type { MetadataRoute } from "next";
import { getFlareRows, getGeo, getMetadata, getSpills } from "@/lib/data";
import { slugify, spillPath } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { isIndexableSpill } from "@/lib/seo";

export const dynamic = "force-dynamic";

function validDate(value?: string | null) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [metadata, spills, states, clusters, blocks] = await Promise.all([
    getMetadata(),
    getSpills(),
    getGeo("states"),
    getFlareRows("cluster"),
    getFlareRows("block"),
  ]);
  const retrievedAt = validDate(metadata.retrievedAt) ?? new Date();

  const staticPages: MetadataRoute.Sitemap = [
    ["", "daily", 1],
    ["/oil-spills", "daily", 0.95],
    ["/gas-flares", "daily", 0.95],
    ["/explore", "daily", 0.9],
    ["/places", "weekly", 0.9],
    ["/oil-spills/analytics", "weekly", 0.85],
    ["/gas-flares/companies", "monthly", 0.75],
    ["/data-and-methods", "monthly", 0.75],
    ["/about", "monthly", 0.65],
    ["/help", "monthly", 0.6],
  ].map(([path, changeFrequency, priority]) => ({
    url: `${siteUrl}${path}`,
    lastModified: retrievedAt,
    changeFrequency: changeFrequency as "daily" | "weekly" | "monthly",
    priority: priority as number,
  }));

  const spillPages: MetadataRoute.Sitemap = spills.filter(isIndexableSpill).map((spill) => ({
    url: `${siteUrl}${spillPath(spill.id)}`,
    lastModified: validDate(spill.incidentdate) ?? retrievedAt,
    changeFrequency: "monthly",
    priority: 0.65,
  }));

  const statePages: MetadataRoute.Sitemap = states.features
    .map((feature) =>
      String(feature.properties.admin1name ?? feature.properties.name ?? ""),
    )
    .filter(Boolean)
    .map((name) => ({
      url: `${siteUrl}/places/states/${slugify(name)}`,
      lastModified: retrievedAt,
      changeFrequency: "weekly",
      priority: 0.75,
    }));

  const uniqueNames = (rows: Array<{ name: string }>) =>
    [...new Set(rows.map((row) => row.name).filter(Boolean))];
  const clusterPages: MetadataRoute.Sitemap = uniqueNames(clusters).map(
    (name) => ({
      url: `${siteUrl}/gas-flares/clusters/${encodeURIComponent(name)}`,
      lastModified: retrievedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );
  const blockPages: MetadataRoute.Sitemap = uniqueNames(blocks).map((name) => ({
    url: `${siteUrl}/oil-blocks/${slugify(name)}`,
    lastModified: retrievedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...statePages,
    ...clusterPages,
    ...blockPages,
    ...spillPages,
  ];
}
