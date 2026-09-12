import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";

function authorized(request: Request) {
  const expected = process.env.SPILLFLARE_REVALIDATE_TOKEN;
  const supplied = request.headers.get("x-spillflare-revalidate-token");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });
  // Data affects hubs, archives, incidents, metadata and sitemap membership.
  // Invalidating the layout clears the Full Route Cache without rebuilding.
  revalidatePath("/", "layout");
  return Response.json({ ok: true, revalidatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
