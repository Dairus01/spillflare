export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: unknown, maximumFractionDigits = 0) {
  const parsed = numberOrNull(value);
  return parsed === null
    ? "Not supplied"
    : new Intl.NumberFormat("en-NG", { maximumFractionDigits }).format(parsed);
}

export function formatVolume(value: unknown) {
  const parsed = numberOrNull(value);
  if (parsed === null) return "Not supplied";
  if (parsed >= 1_000_000) return `${(parsed / 1_000_000).toFixed(2)}M mscf`;
  if (parsed >= 1_000) return `${(parsed / 1_000).toFixed(1)}K mscf`;
  return `${formatNumber(parsed, 1)} mscf`;
}

export function formatDate(
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "Not supplied";
  const date = new Date(
    `${value.length === 7 ? `${value}-01` : value}T00:00:00Z`,
  );
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(
    "en-NG",
    options ?? { day: "numeric", month: "short", year: "numeric" },
  ).format(date);
}

export function titleCase(value?: string | null) {
  if (!value) return "Not supplied";
  return value
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Build a stable detail URL from the source record ID, never the slash-delimited incident number. */
export function spillPath(id: string) {
  return `/oil-spills/${encodeURIComponent(id)}`;
}

export const stateCodes: Record<string, string> = {
  AB: "Abia",
  AD: "Adamawa",
  AK: "Akwa Ibom",
  AN: "Anambra",
  BA: "Bauchi",
  BY: "Bayelsa",
  BE: "Benue",
  BO: "Borno",
  CR: "Cross River",
  DE: "Delta",
  EB: "Ebonyi",
  ED: "Edo",
  EK: "Ekiti",
  EN: "Enugu",
  FC: "Federal Capital Territory",
  GO: "Gombe",
  IM: "Imo",
  JI: "Jigawa",
  KD: "Kaduna",
  KN: "Kano",
  KT: "Katsina",
  KE: "Kebbi",
  KO: "Kogi",
  KW: "Kwara",
  LA: "Lagos",
  NA: "Nasarawa",
  NI: "Niger",
  OG: "Ogun",
  ON: "Ondo",
  OS: "Osun",
  OY: "Oyo",
  PL: "Plateau",
  RI: "Rivers",
  SO: "Sokoto",
  TA: "Taraba",
  YO: "Yobe",
  ZA: "Zamfara",
};

export const spillLabels: Record<string, Record<string, string>> = {
  contaminant: { cr: "Crude oil", pp: "Petroleum product", ch: "Chemical" },
  cause: {
    sab: "Sabotage / theft",
    eqf: "Equipment failure",
    cor: "Corrosion",
    ome: "Operational/maintenance error",
    ytd: "Yet to determine",
    op: "Operational/maintenance error",
  },
  spillareahabitat: {
    sw: "Swamp",
    of: "Offshore",
    ld: "Land",
    iw: "Inland water",
  },
  typeoffacility: {
    pl: "Pipeline",
    fp: "Flowline",
    tk: "Tank",
    wh: "Wellhead",
  },
};

export function codedLabel(field: string, value?: string | null) {
  if (!value) return "Not supplied";
  return spillLabels[field]?.[value.toLowerCase()] ?? titleCase(value);
}
