import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Layers3, Waves } from "lucide-react";
import { NigeriaMap } from "@/components/map";
import { Metric, SourceRail } from "@/components/ui";
import {
  flarePeriod,
  getGeo,
  getLatestSpills,
  getMetadata,
  spillCoordinates,
} from "@/lib/data";
import { formatNumber, formatVolume, numberOrNull } from "@/lib/format";
import { buildSourceSummary } from "@/lib/source-summary";
import type { MapPoint } from "@/types/domain";
export const metadata: Metadata = { title: "Explore map", alternates: { canonical: "/explore" } };
export default async function ExplorePage() {
  const [spills, flares, states, metadata] = await Promise.all([
    getLatestSpills(180),
    flarePeriod("state"),
    getGeo("states"),
    getMetadata(),
  ]);
  const sourceSummary = buildSourceSummary(spills, metadata);
  const spillPoints: MapPoint[] = spills.flatMap((row) => {
    const coordinates = spillCoordinates(row);
    return coordinates
      ? [
          {
            id: row.id,
            ...coordinates,
            title: `Spill ${row.incidentnumber ?? row.id}`,
            subtitle: row.sitelocationname,
            kind: "spill" as const,
            href: `/oil-spills/${row.incidentnumber ?? row.id}`,
          },
        ]
      : [];
  });
  const flarePoints: MapPoint[] = flares.flatMap((row) => {
    const lat = numberOrNull(row.y),
      lng = numberOrNull(row.x);
    return lat !== null && lng !== null
      ? [
          {
            id: `flare-${row.name}`,
            lat,
            lng,
            title: `${row.name} State`,
            subtitle: `${formatVolume(row.mscf)} · May 2026`,
            kind: "flare" as const,
            href: `/places/states/${row.name.toLowerCase().replace(/\s+/g, "-")}`,
          },
        ]
      : [];
  });
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">National explorer</span>
          <h1>Explore Nigeria&apos;s environmental records</h1>
          <p>
            Move from a national view to a spill, flare geography or place
            profile while keeping every source and time period visible.
          </p>
        </div>
      </section>
      <SourceRail
        label="Combined view · sources remain independent"
        observation={sourceSummary.latestObservation}
        retrieved={sourceSummary.retrievedAt}
      />
      <div className="wide-container page-pad">
        <div className="filter-bar">
          <span className="badge">
            <Layers3 size={13} /> Layers
          </span>
          <Link className="button ghost" href="/oil-spills">
            <Waves size={15} />
            Oil spills
          </Link>
          <Link className="button ghost" href="/gas-flares">
            <Flame size={15} />
            Gas flares
          </Link>
          <div className="filter-spacer" />
          <Link className="text-link" href="/data-and-methods">
            How this map works
          </Link>
        </div>
        <div className="metric-grid" style={{ marginBottom: 18 }}>
          <Metric
            label="Recent mapped spills"
            value={formatNumber(spillPoints.length)}
            detail="Latest source records with valid coordinates"
          />
          <Metric
            label="States with detected flaring"
            value={formatNumber(flarePoints.length)}
            detail="May 2026 tracker rows"
          />
          <Metric
            label="Gas flare total"
            value={formatVolume(
              flares.reduce(
                (sum, row) => sum + (numberOrNull(row.mscf) ?? 0),
                0,
              ),
            )}
            detail="State aggregation only"
          />
          <Metric
            label="Geographic coverage"
            value="Nigeria"
            detail="Includes valid offshore points"
          />
        </div>
        <NigeriaMap
          points={[...spillPoints, ...flarePoints]}
          polygons={states}
          height={680}
          center={[7.2, 8.3]}
          zoom={6}
        />
      </div>
    </>
  );
}
