import type { SourceMetadata, SpillRow } from "@/types/domain";
import { parseW3cDate, trustedIncidentLastModified } from "@/lib/sitemap-date";

const flareSourceKey = /^flare/;
const observationPattern = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

function parseObservation(value: string) {
  const match = value.match(observationPattern);
  if (!match) return undefined;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = dayText ? Number(dayText) : 1;
  if (year < 1000 || month < 1 || month > 12 || day < 1) return undefined;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function observationRank(value: string) {
  const match = value.match(observationPattern);
  const date = parseObservation(value);
  if (!match || !date) return undefined;
  // A YYYY-MM flare observation represents the full month. Use that month's
  // end as its internal comparison boundary while preserving YYYY-MM output.
  return match[3]
    ? date.getTime()
    : Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999);
}

function latestFlareObservation(
  metadata: SourceMetadata,
  retrievedAt: Date | undefined,
) {
  return Object.entries(metadata.sources)
    .filter(([key]) => flareSourceKey.test(key))
    .map(([, source]) => source.latestObservation)
    .map((value) => {
      if (typeof value !== "string") return undefined;
      const date = parseObservation(value);
      const rank = observationRank(value);
      return date && rank !== undefined &&
        (!retrievedAt || date.getTime() <= retrievedAt.getTime())
        ? { value, rank }
        : undefined;
    })
    .filter((item): item is { value: string; rank: number } => Boolean(item))
    .sort((a, b) => a.rank - b.rank || a.value.localeCompare(b.value))
    .at(-1)?.value ?? null;
}

function latestTrustedOilSpillObservation(
  spills: SpillRow[],
  retrievedAt: Date | undefined,
) {
  return (
    spills
      .map((spill) => trustedIncidentLastModified(spill, retrievedAt))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())
      .at(-1)
      ?.toISOString()
      .slice(0, 10) ?? null
  );
}

export type SourceSummary = {
  latestOilSpillObservation: string | null;
  latestGasFlareObservation: string | null;
  latestObservation: string | null;
  retrievedAt: string;
};

/**
 * Summarise the latest dated observations without conflating them with the
 * retrieval timestamp. Oil-spill dates use the shared trusted-date rules;
 * flare dates are the validated observation periods recorded in metadata.
 */
export function buildSourceSummary(
  spills: SpillRow[],
  metadata: SourceMetadata,
): SourceSummary {
  const retrievedAt = parseW3cDate(metadata.retrievedAt);
  const latestOilSpillObservation = latestTrustedOilSpillObservation(
    spills,
    retrievedAt,
  );
  const latestGasFlareObservation = latestFlareObservation(
    metadata,
    retrievedAt,
  );
  const latestObservation = [
    latestOilSpillObservation,
    latestGasFlareObservation,
  ]
    .map((value) =>
      value
        ? { value, rank: observationRank(value) }
        : undefined,
    )
    .filter(
      (item): item is { value: string; rank: number } =>
        item !== undefined && item.rank !== undefined,
    )
    .sort((a, b) => a.rank - b.rank || a.value.localeCompare(b.value))
    .at(-1)?.value ?? null;

  return {
    latestOilSpillObservation,
    latestGasFlareObservation,
    latestObservation,
    retrievedAt: metadata.retrievedAt,
  };
}
