import type { SpillRow } from "@/types/domain";
import { isIndexableSpill } from "@/lib/seo";
import { trustedIncidentYear } from "@/lib/sitemap-date";

export const archivePageSize = 50;
export const undatedArchiveKey = "undated";

export function archiveYear(row: SpillRow, retrievedAt?: Date) {
  return trustedIncidentYear(row, retrievedAt) ?? undatedArchiveKey;
}

export function archiveGroups(rows: SpillRow[], retrievedAt?: Date) {
  const groups = new Map<string, SpillRow[]>();
  for (const row of rows.filter(isIndexableSpill)) {
    const key = archiveYear(row, retrievedAt);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        String(b.incidentdate ?? "").localeCompare(String(a.incidentdate ?? "")) ||
        String(a.id).localeCompare(String(b.id)),
    );
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === undatedArchiveKey) return 1;
    if (b === undatedArchiveKey) return -1;
    return b.localeCompare(a);
  });
}

export function archiveYearPath(year: string, page = 1) {
  const base = `/oil-spills/archive/year/${year}`;
  return page > 1 ? `${base}/page/${page}` : base;
}

export function archivePageCount(rows: SpillRow[]) {
  return Math.max(1, Math.ceil(rows.length / archivePageSize));
}
