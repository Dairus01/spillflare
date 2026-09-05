import type { FlareRow, GeoFeature, SpillRow } from "@/types/domain";
import { numberOrNull, slugify } from "@/lib/format";

export type Coordinate = { lat: number; lng: number };

function ringContainsPoint(ring: number[][], point: Coordinate) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    const intersects =
      y > point.lat !== previousY > point.lat &&
      point.lng < ((previousX - x) * (point.lat - y)) / (previousY - y) + x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function featureContainsPoint(feature: GeoFeature, point: Coordinate) {
  if (feature.geometry.type === "Polygon") {
    const [outer, ...holes] = feature.geometry.coordinates;
    return ringContainsPoint(outer, point) && !holes.some((ring) => ringContainsPoint(ring, point));
  }
  if (feature.geometry.type === "MultiPolygon") {
    return feature.geometry.coordinates.some(([outer, ...holes]) =>
      ringContainsPoint(outer, point) && !holes.some((ring) => ringContainsPoint(ring, point)),
    );
  }
  return false;
}

export function flareCoordinate(row?: FlareRow | null): Coordinate | null {
  const lat = numberOrNull(row?.y);
  const lng = numberOrNull(row?.x);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

export function distanceKm(a: Coordinate, b: Coordinate) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDistance = radians(b.lat - a.lat);
  const longitudeDistance = radians(b.lng - a.lng);
  const value =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(longitudeDistance / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(value));
}

export function uniqueLatestRows(rows: FlareRow[]) {
  const latest = new Map<string, FlareRow>();
  for (const row of rows) {
    const current = latest.get(row.name);
    if (!current || String(row.month ?? "").localeCompare(String(current.month ?? "")) > 0) {
      latest.set(row.name, row);
    }
  }
  return [...latest.values()];
}

export function spillMentionsBlock(row: SpillRow, blockName: string) {
  const source = [row.sitelocationname, row.descriptionofimpact].filter(Boolean).join(" ");
  if (!source) return false;
  const tokens = blockName.match(/^(OML|OPL|Block)\s*([0-9]+[A-Z]?)$/i);
  if (!tokens) return slugify(source).includes(slugify(blockName));
  const [, prefix, number] = tokens;
  return new RegExp(`\\b${prefix}[-\\s]*0*${number}\\b`, "i").test(source);
}
