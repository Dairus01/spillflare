import { buildSitemapGroups, sitemapXml } from "@/lib/sitemaps";

export const revalidate = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const groupName = name.endsWith(".xml") ? name.slice(0, -4) : "";
  const group = (await buildSitemapGroups()).find((candidate) => candidate.name === groupName);
  if (!group) return new Response("Sitemap not found", { status: 404 });
  return new Response(sitemapXml(group.entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
