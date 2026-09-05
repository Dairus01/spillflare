import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { FlareTrend } from "@/components/flare-chart";
import { NigeriaMap } from "@/components/map";
import { DataNote, Metric, SourceRail } from "@/components/ui";
import { getFlareRows, getGeo, getMetadata, getSpills } from "@/lib/data";
import {
  distanceKm,
  featureContainsPoint,
  flareCoordinate,
  spillMentionsBlock,
  uniqueLatestRows,
} from "@/lib/geo-relations";
import { formatDate, formatNumber, formatVolume, numberOrNull, slugify, spillPath } from "@/lib/format";
import { spillStateName } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import type { MapPoint } from "@/types/domain";
import {
  concessionIdentityNames,
  describeConcessionRelationship,
  findConcessionLineage,
} from "@/data/concession-lineage";

const getBlockContext = cache(async (name: string) => {
  const [rows, geo, spills, clusterRows, states] = await Promise.all([
    getFlareRows("block"),
    getGeo("blocks"),
    getSpills(),
    getFlareRows("cluster"),
    getGeo("states"),
  ]);
  const decoded = decodeURIComponent(name);
  const names = [...new Set(rows.map((row) => row.name))];
  const blockName = names.find((item) => slugify(item) === slugify(decoded));
  if (!blockName) return null;
  const lineage = findConcessionLineage(blockName);
  const identityNames = concessionIdentityNames(blockName);
  const series = rows
    .filter((row) => identityNames.includes(row.name) && row.month && numberOrNull(row.mscf) !== null)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const representative = series.filter((row) => row.name === blockName).at(-1) ?? series.at(-1) ?? rows.find((row) => row.name === blockName);
  const coordinate = flareCoordinate(representative);
  const spatialNames = lineage?.canonicalBlock === "OML 119" ? [...identityNames, "OML 119 A", "OML 119 B", "Okono"] : identityNames;
  const features = geo.features.filter((feature) => spatialNames.some((item) => slugify(String(feature.properties.block_name ?? feature.properties.contract ?? "")) === slugify(item)));
  const spillMatches = spills
    .filter((row) => identityNames.some((item) => spillMentionsBlock(row, item)))
    .sort((a, b) => String(b.incidentdate ?? "").localeCompare(String(a.incidentdate ?? "")));
  const stateNames = [...new Set(spillMatches.map(spillStateName).filter(Boolean) as string[])];
  if (coordinate) {
    const coordinateState = states.features.find((feature) => featureContainsPoint(feature, coordinate));
    const name = coordinateState ? String(coordinateState.properties.admin1name ?? coordinateState.properties.name ?? "") : "";
    if (name && !stateNames.includes(name)) stateNames.unshift(name);
  }
  const latestClusters = uniqueLatestRows(clusterRows).filter((row) => flareCoordinate(row));
  const containedClusters = features.length
    ? latestClusters.filter((row) => features.some((feature) => featureContainsPoint(feature, flareCoordinate(row)!)))
    : [];
  const nearbyClusters = coordinate
    ? latestClusters
        .map((row) => ({ row, distance: distanceKm(coordinate, flareCoordinate(row)!) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
    : [];
  const operators = [...new Set(features.map((feature) => String(feature.properties.operator ?? "")).filter(Boolean))];
  const terrains = [...new Set(features.map((feature) => String(feature.properties.terrain ?? "")).filter(Boolean))];
  const observedIdentities = identityNames.map((identity) => ({
    identity,
    flareCount: series.filter((row) => row.name === identity).length,
    spillCount: spills.filter((row) => spillMentionsBlock(row, identity)).length,
  })).filter((item) => item.flareCount || item.spillCount);
  return { blockName, lineage, identityNames, observedIdentities, series, representative, coordinate, features, spillMatches, stateNames, containedClusters, nearbyClusters, operators, terrains };
});

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const context = await getBlockContext(name);
  if (!context) return { title: "Nigerian oil block not found" };
  const { blockName, lineage, series, representative, spillMatches, stateNames, operators } = context;
  const identityTitle = lineage && lineage.canonicalBlock !== blockName ? `${blockName} / ${lineage.canonicalBlock}` : blockName;
  const title = `${identityTitle} Nigeria: Oil Spills & Gas Flaring Data`;
  const facts = [
    series.length ? `${formatNumber(series.length)} monthly flare observations` : "mapped oil-block information",
    spillMatches.length ? `${formatNumber(spillMatches.length)} text-matched spill records` : null,
    stateNames.length ? `coverage connected to ${stateNames.join(", ")}` : null,
    operators.length ? `operator field: ${operators.join(", ")}` : null,
  ].filter(Boolean).join(", ");
  const description = `Explore ${blockName} in Nigeria: ${facts}. ${representative?.month ? `Latest flare observation ${formatDate(representative.month, { month: "long", year: "numeric" })}.` : "No monthly flare observation is supplied for this block."}`;
  return {
    title,
    description,
    alternates: { canonical: `/oil-blocks/${slugify(blockName)}` },
    openGraph: { title, description, type: "website", url: `/oil-blocks/${slugify(blockName)}` },
  };
}

export default async function BlockPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const [context, metadata] = await Promise.all([getBlockContext(name), getMetadata()]);
  if (!context) notFound();
  const { blockName, lineage, identityNames, observedIdentities, series, coordinate, features, spillMatches, stateNames, containedClusters, nearbyClusters, operators, terrains } = context;
  const identityTitle = lineage && lineage.canonicalBlock !== blockName ? `${blockName} / ${lineage.canonicalBlock}` : blockName;
  const latest = series.at(-1);
  const point: MapPoint[] = coordinate ? [{ id: blockName, ...coordinate, title: blockName, subtitle: latest ? `${formatVolume(latest.mscf)} · ${latest.month}` : "Mapped block location", kind: "flare" }] : [];
  const trend = series.slice(-18).map((row) => ({ month: String(row.month).slice(2), value: numberOrNull(row.mscf) ?? 0 }));
  const relatedClusters = containedClusters.length ? containedClusters.slice(0, 8).map((row) => ({ row, distance: coordinate ? distanceKm(coordinate, flareCoordinate(row)!) : null, relationship: "Inside block polygon" })) : nearbyClusters.map(({ row, distance }) => ({ row, distance, relationship: "Nearby tracker coordinate" }));
  const blockPath = `/oil-blocks/${slugify(blockName)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}${blockPath}/#webpage`,
        url: `${siteUrl}${blockPath}`,
        name: `${identityTitle} Nigeria: Oil Spills & Gas Flaring Data`,
        description: `Source-backed concession lineage, oil-block geography, gas flare observations and explicitly text-matched oil spill records for ${identityTitle}.`,
        isPartOf: { "@id": `${siteUrl}/#website` },
        spatialCoverage: { "@type": "Country", name: "Nigeria" },
      },
      {
        "@type": "Dataset",
        name: `${identityTitle} environmental records`,
        description: `${formatNumber(series.length)} monthly flare observations and ${formatNumber(spillMatches.length)} spill records explicitly mentioning ${identityNames.join(" or ")}. Source labels are preserved.`,
        url: `${siteUrl}${blockPath}`,
        temporalCoverage: series.length ? `${series[0].month}/${latest?.month}` : undefined,
        spatialCoverage: coordinate ? { "@type": "Place", name: `${blockName}, Nigeria`, geo: { "@type": "GeoCoordinates", latitude: coordinate.lat, longitude: coordinate.lng } } : { "@type": "Country", name: "Nigeria" },
        creator: { "@id": `${siteUrl}/#organization` },
        isAccessibleForFree: true,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Gas flaring", item: `${siteUrl}/gas-flares` },
          { "@type": "ListItem", position: 2, name: "Oil blocks", item: `${siteUrl}/gas-flares?area=block` },
          { "@type": "ListItem", position: 3, name: blockName, item: `${siteUrl}${blockPath}` },
        ],
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <section className="detail-hero"><div className="container"><div className="breadcrumbs"><Link href="/gas-flares">Gas flaring</Link> / Oil blocks / {blockName}</div><div className="detail-title"><div><span className="badge">Oil-block profile</span><h1>{identityTitle} Oil Spills and Gas Flaring Data</h1><p>Explore tracker observations, verified concession lineage, mapped block context and oil spill records across the documented identities for this Nigerian concession.</p></div></div></div></section>
    <SourceRail label="Nigeria Gas Flare Tracker · block aggregation" observation={latest?.month} retrieved={metadata.retrievedAt}/>
    <div className="container page-pad">
      <div className="metric-grid" style={{ marginBottom: 22 }}><Metric label="Flare observations" value={formatNumber(series.length)} detail={series.length ? `${formatDate(series[0].month, { month: "short", year: "numeric" })}–${formatDate(latest?.month, { month: "short", year: "numeric" })}` : "No monthly values supplied"}/><Metric label="Latest flare estimate" value={latest ? formatVolume(latest.mscf) : "Not supplied"} detail={latest?.month ? formatDate(latest.month, { month: "long", year: "numeric" }) : "Mapped block only"}/><Metric label="Matched spill records" value={formatNumber(spillMatches.length)} detail="Explicit block-name matches"/><Metric label="Mapped context" value={features.length ? `${formatNumber(features.length)} polygon${features.length === 1 ? "" : "s"}` : coordinate ? "Coordinate only" : "Not supplied"} detail={[...terrains, ...operators].join(" · ") || "No operator asserted"}/></div>
      {lineage && <section className="panel" style={{ marginBottom: 22 }}><div className="panel-head"><h2>Verified concession lineage</h2><span className="mono">Original source labels preserved</span></div><div className="panel-body prose">{lineage.aliases.map((alias) => <div key={`${alias.name}-${alias.relationship}`}><p><strong>{describeConcessionRelationship(lineage.canonicalBlock, alias)}</strong> SpillFlare groups matching evidence under this documented relationship while retaining the identifier used by every underlying record.</p><p>Evidence: {alias.sources.map((source, index) => <span key={`${source.publisher}-${source.url}`}>{index ? "; " : ""}<a href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title}</a> ({source.reference})</span>)}{"."}</p></div>)}{observedIdentities.length > 0 && <p>Evidence currently represented by identifier: {observedIdentities.map((item, index) => <span key={item.identity}>{index ? "; " : ""}<strong>{item.identity}</strong> — {formatNumber(item.flareCount)} flare observations, {formatNumber(item.spillCount)} spill records</span>)}{"."}</p>}</div></section>}
      <section className="panel" style={{ marginBottom: 22 }}><div className="panel-head"><h2>{identityTitle} record summary</h2></div><div className="panel-body prose"><p>This authority page combines evidence matching the verified identifiers <strong>{identityNames.join(" and ")}</strong> without rewriting the label supplied by either source. It contains {series.length ? <><strong>{formatNumber(series.length)} monthly gas flare observations</strong> from {formatDate(series[0].month, { month: "long", year: "numeric" })} through {formatDate(latest?.month, { month: "long", year: "numeric" })}</> : "mapped oil-block information without supplied monthly flare values"}. {spillMatches.length ? <>The oil spill source contains <strong>{formatNumber(spillMatches.length)} records</strong> explicitly mentioning one of these verified identities.</> : <>No oil spill record explicitly mentions these identities in the searchable location or impact fields.</>}</p>{stateNames.length > 0 && <p>Connected state records: {stateNames.map((state, index) => <span key={state}>{index ? ", " : ""}<Link href={`/places/states/${slugify(state)}`}>{state}</Link></span>)}. A state connection can come from an explicitly matched spill or the supplied block coordinate and does not define the block&apos;s complete legal boundary.</p>}<p><Link href="/gas-flares">Compare national gas flaring data</Link> or browse the related clusters and incident records below.</p></div></section>
      <div className="split"><div className="panel"><div className="panel-head"><h2>Block context</h2></div><NigeriaMap points={point} polygons={features.length ? { type: "FeatureCollection", features } : undefined} height={470} center={coordinate ? [coordinate.lat, coordinate.lng] : [4, 7.2]} zoom={8}/></div><div className="panel"><div className="panel-head"><h2>Source interpretation</h2></div><div className="panel-body"><p>The underlying records retain their original identifiers: <strong>{identityNames.join(", ")}</strong>. Documentary lineage merges evidence for discovery and analysis; it does not silently rename historical observations.</p>{operators.length > 0 && <p><strong>Operator field in matched geography:</strong> {operators.join(", ")}.</p>}{terrains.length > 0 && <p><strong>Terrain:</strong> {terrains.join(", ")}.</p>}{!features.length && <DataNote>No verified polygon-name match is available. Documentary lineage does not manufacture or substitute a boundary.</DataNote>}</div></div></div>
      {trend.length > 0 && <div className="panel" style={{ marginTop: 22 }}><div className="panel-head"><h2>Recent {blockName} flare observations</h2></div><div className="panel-body"><FlareTrend data={trend}/></div></div>}
      {spillMatches.length > 0 && <section className="panel" style={{ marginTop: 22 }}><div className="panel-head"><h2>Recent oil spill records mentioning {blockName}</h2><span className="mono">Explicit source-text matches</span></div><div className="record-list">{spillMatches.slice(0, 8).map((spill) => <Link className="record-row" href={spillPath(spill.id)} key={spill.id}><time>{formatDate(spill.incidentdate, { month: "short", year: "numeric" })}</time><div><strong>{spill.incidentnumber ?? spill.id} · {spill.company ?? "Company not supplied"}</strong><p>{spill.sitelocationname ?? "Location not supplied"}</p></div><span className="status">Spill</span></Link>)}</div></section>}
      {relatedClusters.length > 0 && <section className="panel" style={{ marginTop: 22 }}><div className="panel-head"><h2>Related flare clusters</h2><span className="mono">{containedClusters.length ? "Coordinate falls inside matched polygon" : "Nearest tracker coordinates"}</span></div><div className="record-list">{relatedClusters.map(({ row, distance, relationship }) => <Link className="record-row" href={`/gas-flares/clusters/${encodeURIComponent(row.name)}`} key={row.name}><time>{distance === null ? "Mapped" : `${distance.toFixed(1)} km`}</time><div><strong>{row.name}</strong><p>{formatVolume(row.mscf)} · {row.month}</p></div><span className="status">{relationship}</span></Link>)}</div></section>}
      <DataNote><strong>Relationship rules:</strong> spill links require an explicit block-name match in source text; cluster links use polygon containment when a matched polygon exists, otherwise they are clearly labelled as coordinate proximity. Neither establishes legal responsibility or ownership.</DataNote>
    </div>
  </>;
}
