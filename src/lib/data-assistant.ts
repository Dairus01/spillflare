import "server-only";

import { getFlareRows, getMetadata, getSpills, searchAll } from "@/lib/data";
import {
  formatDate,
  formatNumber,
  formatVolume,
  numberOrNull,
  spillPath,
  stateCodes,
} from "@/lib/format";

type FlareArea =
  | "state"
  | "lga"
  | "cluster"
  | "block"
  | "company"
  | "onshore_offshore";

const sourceKeyByArea: Record<FlareArea, string> = {
  state: "flareState",
  lga: "flareLga",
  cluster: "flareCluster",
  block: "flareBlock",
  company: "flareCompany",
  onshore_offshore: "flareOnshoreOffshore",
};

const ignoredSearchWords = new Set([
  "about",
  "after",
  "before",
  "between",
  "could",
  "data",
  "does",
  "from",
  "have",
  "latest",
  "most",
  "oil",
  "show",
  "spill",
  "that",
  "the",
  "these",
  "this",
  "what",
  "which",
  "with",
]);

function cleanText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function searchTerms(value?: string) {
  return cleanText(value)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !ignoredSearchWords.has(term));
}

function stateMatches(value: string | null | undefined, state?: string) {
  if (!state?.trim()) return true;
  const search = cleanText(state);
  const code = Object.entries(stateCodes).find(
    ([, name]) => cleanText(name) === search,
  )?.[0];
  const rowState = cleanText(value);
  return (
    rowState === search ||
    rowState.includes(search) ||
    (code !== undefined && rowState.split(/[^a-z]/).includes(code.toLowerCase()))
  );
}

function withinMonthRange(
  month: string | null,
  startMonth?: string,
  endMonth?: string,
) {
  if (!month) return false;
  return (
    (!startMonth || month >= startMonth) && (!endMonth || month <= endMonth)
  );
}

export async function findOilSpills(input: {
  query?: string;
  state?: string;
  company?: string;
  year?: number;
  limit?: number;
}) {
  const [spills, metadata] = await Promise.all([getSpills(), getMetadata()]);
  const terms = searchTerms(input.query);
  const company = cleanText(input.company);
  const matching = spills
    .filter((row) => {
      if (!stateMatches(row.statesaffected, input.state)) return false;
      if (company && !cleanText(row.company).includes(company)) return false;
      if (input.year && !row.incidentdate?.startsWith(String(input.year))) {
        return false;
      }
      if (!terms.length) return true;
      const text = [
        row.incidentnumber,
        row.company,
        row.sitelocationname,
        row.lga,
        row.statesaffected,
        row.cause,
        row.contaminant,
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => String(b.incidentdate).localeCompare(String(a.incidentdate)));

  const suppliedQuantities = matching
    .map((row) => numberOrNull(row.estimatedquantity))
    .filter((value): value is number => value !== null);
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 15);

  return {
    dataset: "NOSDRA oil-spill records",
    sourceUrl: metadata.sources.spillsPrimary.url,
    retrievedAt: metadata.retrievedAt,
    filters: {
      query: input.query || null,
      state: input.state || null,
      company: input.company || null,
      year: input.year || null,
    },
    matchCount: matching.length,
    reportedQuantity: {
      value: suppliedQuantities.reduce((total, value) => total + value, 0),
      display: `${formatNumber(suppliedQuantities.reduce((total, value) => total + value, 0), 2)} bbls`,
      note: `${formatNumber(matching.length - suppliedQuantities.length)} matching records have no supplied quantity and are excluded from the sum.`,
    },
    records: matching.slice(0, limit).map((row) => ({
      reference: `Oil spill record ${row.id}`,
      detailUrl: spillPath(row.id),
      incidentNumber: row.incidentnumber ?? "Not supplied",
      date: formatDate(row.incidentdate),
      company: row.company ?? "Not supplied",
      state: row.statesaffected ?? "Not supplied",
      lga: row.lga ?? "Not supplied",
      location: row.sitelocationname ?? "Not supplied",
      quantity: row.estimatedquantity
        ? `${formatNumber(row.estimatedquantity, 2)} bbls`
        : "Not supplied",
      cause: row.cause ?? "Not supplied",
      status: row.status ?? "Not supplied",
    })),
  };
}

export async function getOilSpillDetail(idOrIncident: string) {
  const [spills, metadata] = await Promise.all([getSpills(), getMetadata()]);
  const target = cleanText(idOrIncident);
  const row = spills.find(
    (item) =>
      cleanText(item.id) === target || cleanText(item.incidentnumber) === target,
  );
  if (!row) {
    return {
      dataset: "NOSDRA oil-spill records",
      sourceUrl: metadata.sources.spillsPrimary.url,
      found: false,
      message: "No source record matched that ID or incident number.",
    };
  }
  return {
    dataset: "NOSDRA oil-spill records",
    sourceUrl: metadata.sources.spillsPrimary.url,
    found: true,
    reference: `Oil spill record ${row.id}`,
    detailUrl: spillPath(row.id),
    record: {
      id: row.id,
      incidentNumber: row.incidentnumber ?? "Not supplied",
      incidentDate: formatDate(row.incidentdate),
      reportDate: formatDate(row.reportdate),
      company: row.company ?? "Not supplied",
      location: row.sitelocationname ?? "Not supplied",
      state: row.statesaffected ?? "Not supplied",
      lga: row.lga ?? "Not supplied",
      quantity: row.estimatedquantity
        ? `${formatNumber(row.estimatedquantity, 2)} bbls`
        : "Not supplied",
      quantityRecovered: row.quantityrecovered
        ? `${formatNumber(row.quantityrecovered, 2)} bbls`
        : "Not supplied",
      cause: row.cause ?? "Not supplied",
      status: row.status ?? "Not supplied",
      description: row.descriptionofimpact ?? "Not supplied",
    },
  };
}

export async function findGasFlares(input: {
  area: FlareArea;
  name?: string;
  startMonth?: string;
  endMonth?: string;
  limit?: number;
}) {
  const [rows, metadata] = await Promise.all([
    getFlareRows(input.area),
    getMetadata(),
  ]);
  const name = cleanText(input.name);
  const matching = rows
    .filter(
      (row) =>
        (!name || cleanText(row.name).includes(name)) &&
        withinMonthRange(row.month, input.startMonth, input.endMonth) &&
        numberOrNull(row.mscf) !== null,
    )
    .sort(
      (a, b) =>
        String(b.month).localeCompare(String(a.month)) ||
        (numberOrNull(b.mscf) ?? 0) - (numberOrNull(a.mscf) ?? 0),
    );
  const source = metadata.sources[sourceKeyByArea[input.area]];
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 20);
  const values = matching
    .map((row) => numberOrNull(row.mscf))
    .filter((value): value is number => value !== null);

  return {
    dataset: `Nigeria Gas Flare Tracker ${input.area} aggregation`,
    sourceUrl: source.url,
    retrievedAt: metadata.retrievedAt,
    latestSourceObservation: source.latestObservation ?? "Not supplied",
    filters: {
      area: input.area,
      name: input.name || null,
      startMonth: input.startMonth || null,
      endMonth: input.endMonth || null,
    },
    matchCount: matching.length,
    totalMscf:
      name && values.length
        ? {
            value: values.reduce((total, value) => total + value, 0),
            display: formatVolume(values.reduce((total, value) => total + value, 0)),
            note: "Only summed for one named geographic entity; do not sum rows across different states, LGAs, clusters or blocks because their areas can overlap.",
          }
        : null,
    coverageNote:
      input.area === "company"
        ? "Company data ends at October 2020 in the supplied tracker data; it is historical, not current company analytics."
        : "A missing row must not be interpreted as zero flaring.",
    records: matching.slice(0, limit).map((row) => ({
      name: row.name,
      month: row.month,
      mscf: formatVolume(row.mscf),
      rawMscf: numberOrNull(row.mscf),
    })),
  };
}

export async function getSourceCoverage() {
  const metadata = await getMetadata();
  return {
    retrievedAt: metadata.retrievedAt,
    spillMirrorAgreement: metadata.spillMirrorAgreement,
    sources: Object.entries(metadata.sources).map(([name, source]) => ({
      name,
      status: source.status,
      sourceUrl: source.url,
      rowOrFeatureCount: source.count ?? "Not supplied",
      latestObservation: source.latestObservation ?? "Not supplied",
      retrievedAt: source.retrievedAt,
      limitation: source.error ?? null,
    })),
  };
}

export async function discoverRecords(query: string) {
  const results = await searchAll(query, 12);
  return {
    query,
    results,
    note: "These are matching public records and pages. Open a result for its complete, source-backed details.",
  };
}
