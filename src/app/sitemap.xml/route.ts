import { buildSitemapGroups, sitemapIndexXml } from "@/lib/sitemaps";

export const revalidate = 300;

export async function GET() {
  return new Response(sitemapIndexXml(await buildSitemapGroups()), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
