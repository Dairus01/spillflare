export type ConcessionRelationship =
  | "converted_to"
  | "formerly"
  | "excised_from";

export type ConcessionSource = {
  publisher: "NEITI" | "NUPRC" | "NNPC/NEPL";
  title: string;
  url: string;
  reference: string;
  verifiedAt: string;
};

export type ConcessionLineage = {
  canonicalBlock: string;
  aliases: Array<{
    name: string;
    relationship: ConcessionRelationship;
    sources: ConcessionSource[];
  }>;
};

const neiti2021: ConcessionSource = {
  publisher: "NEITI",
  title: "NEITI 2021 Oil and Gas Industry Report",
  url: "https://eiti.org/sites/default/files/2024-01/NEITI-OGA-2021-Report.pdf",
  reference: "Table 14 — Producing PSC Blocks, page 42",
  verifiedAt: "2026-09-05",
};

const nuprc2025: ConcessionSource = {
  publisher: "NUPRC",
  title: "Nigerian Upstream Concession Situation Report — 1 June 2025",
  url: "https://www.nuprc.gov.ng/wp-content/uploads/2025/06/NUPRC-Concession-Situation-%40-1-June-2025-updated.pdf",
  reference: "OML 118 row; predecessor block field records OPL 212",
  verifiedAt: "2026-09-05",
};

const nuprc2026: ConcessionSource = {
  publisher: "NUPRC",
  title: "Nigerian Upstream Concession Situation Report — 1 June 2026",
  url: "https://www.nuprc.gov.ng/wp-content/uploads/2026/06/NUPRC-Concession-Situation-Final-Merged-%40-1st-June-2026-V.2.pdf",
  reference: "PML 14 row; Block Excised From: OPL 2006",
  verifiedAt: "2026-09-05",
};

const nnpcNepl: ConcessionSource = {
  publisher: "NNPC/NEPL",
  title: "NNPC E&P Limited — Historical Activities",
  url: "https://nnpcgroup.com/nnpc-e-and-p-limited-nepl",
  reference: "Historical Activities; describes OPL 91 as now OML 119",
  verifiedAt: "2026-09-05",
};

export const concessionLineages: ConcessionLineage[] = [
  {
    canonicalBlock: "OML 118",
    aliases: [
      { name: "OPL 212", relationship: "converted_to", sources: [neiti2021, nuprc2025] },
    ],
  },
  {
    canonicalBlock: "OML 130",
    aliases: [
      { name: "OPL 246", relationship: "converted_to", sources: [neiti2021] },
    ],
  },
  {
    canonicalBlock: "OML 146",
    aliases: [
      { name: "OPL 277", relationship: "converted_to", sources: [neiti2021] },
    ],
  },
  {
    canonicalBlock: "OML 147",
    aliases: [
      { name: "OPL 275", relationship: "converted_to", sources: [neiti2021] },
    ],
  },
  {
    canonicalBlock: "OML 119",
    aliases: [
      { name: "OPL 091", relationship: "formerly", sources: [nnpcNepl] },
    ],
  },
  {
    canonicalBlock: "PML 14",
    aliases: [
      { name: "OPL 2006", relationship: "excised_from", sources: [nuprc2026] },
    ],
  },
];

function normalizedConcessionName(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").replace(/\b(OPL|OML|PML) 0+(\d)/, "$1 $2").trim();
}

export function findConcessionLineage(name: string) {
  const normalized = normalizedConcessionName(name);
  return concessionLineages.find(
    (lineage) =>
      normalizedConcessionName(lineage.canonicalBlock) === normalized ||
      lineage.aliases.some((alias) => normalizedConcessionName(alias.name) === normalized),
  );
}

export function concessionIdentityNames(name: string) {
  const lineage = findConcessionLineage(name);
  return lineage
    ? [lineage.canonicalBlock, ...lineage.aliases.map((alias) => alias.name)]
    : [name];
}

export function describeConcessionRelationship(
  canonicalBlock: string,
  alias: ConcessionLineage["aliases"][number],
) {
  if (alias.relationship === "converted_to") {
    return `${alias.name} was subsequently converted to ${canonicalBlock}.`;
  }
  if (alias.relationship === "excised_from") {
    return `${canonicalBlock} was excised from ${alias.name}.`;
  }
  return `${canonicalBlock} was formerly identified as ${alias.name}.`;
}
