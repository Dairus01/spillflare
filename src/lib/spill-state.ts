import { stateCodes } from "@/lib/format";
import type { SpillRow } from "@/types/domain";

const stateNameLookup = new Map(
  Object.values(stateCodes).map((name) => [name.toLowerCase(), name]),
);

/** Resolve only explicit source state values; never infer state from location text. */
export function spillStateNames(row: SpillRow) {
  const value = row.statesaffected?.trim();
  if (!value) return [];
  return [...new Set(value.split(",").flatMap((part) => {
    const token = part.trim();
    if (!token) return [];
    const code = token.toUpperCase() === "FCT" ? "FC" : token.toUpperCase();
    const name = stateCodes[code] ?? stateNameLookup.get(token.toLowerCase());
    return name ? [name] : [];
  }))];
}

export function spillMatchesState(row: SpillRow, stateName: string) {
  return spillStateNames(row).some(
    (name) => name.toLowerCase() === stateName.toLowerCase(),
  );
}
