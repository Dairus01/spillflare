import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { FlareTrend } from "@/components/flare-chart";
import { NigeriaMap } from "@/components/map";
import { DataNote, Metric, SourceRail } from "@/components/ui";
import { flareSeries, getFlareRows, getGeo, getMetadata } from "@/lib/data";
import {
  distanceKm,
  featureContainsPoint,
  flareCoordinate,
  uniqueLatestRows,
} from "@/lib/geo-relations";
import { formatDate, formatNumber, formatVolume, numberOrNull, slugify } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import type { MapPoint } from "@/types/domain";

const getClusterContext = cache(async (name: string) => {
  const cluster = decodeURIComponent(name);
  const [series, clusterGeo, states, blocks, allClusters] = await Promise.all([
    flareSeries("cluster", cluster),
    getGeo("clusters"),
    getGeo("states"),
    getGeo("blocks"),
    getFlareRows("cluster"),
  ]);
  if (!series.length) return null;
  const latest = series.at(-1)!;
  const coordinate = flareCoordinate(latest);
  const feature = clusterGeo.features.find(
    (item) => String(item.properties.name ?? item.properties.Name ?? "").toLowerCase() === cluster.toLowerCase(),
  );
  const stateFeature = coordinate
    ? states.features.find((item) => featureContainsPoint(item, coordinate))
    : undefined;
  const stateName = stateFeature
    ? String(stateFeature.properties.admin1name ?? stateFeature.properties.name ?? "")
    : null;
  const containingBlocks = coordinate
    ? blocks.features.filter((item) => featureContainsPoint(item, coordinate))
    : [];
  const blockNames = containingBlocks
    .map((item) => String(item.properties.block_name ?? item.properties.contract ?? ""))
    .filter(Boolean);
  const nearbyClusters = coordinate
    ? uniqueLatestRows(allClusters)
        .filter((row) => row.name !== cluster && flareCoordinate(row))
        .map((row) => ({ row, distance: distanceKm(coordinate, flareCoordinate(row)!) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
    : [];
  return { cluster, series, latest, coordinate, feature, stateName, blockNames, nearbyClusters };
});

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const context = await getClusterContext(name);
  if (!context) return { title: "Gas flare cluster not found" };
  const { cluster, series, latest, stateName, blockNames } = context;
  const location = stateName ? ` in ${stateName} State` : blockNames[0] ? ` near ${blockNames[0]}` : " in Nigeria";
  const title = `${cluster} Gas Flaring Data${location}`;
  const description = `Explore ${formatNumber(series.length)} monthly gas flare observations for ${cluster}${location}, from ${formatDate(series[0].month, { month: "long", year: "numeric" })} through ${formatDate(latest.month, { month: "long", year: "numeric" })}. Latest reported estimate: ${formatVolume(latest.mscf)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/gas-flares/clusters/${encodeURIComponent(cluster)}` },
    openGraph: { title, description, type: "website", url: `/gas-flares/clusters/${encodeURIComponent(cluster)}` },
  };
}

export default async function ClusterPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const [context, metadata] = await Promise.all([getClusterContext(name), getMetadata()]);
  if (!context) notFound();
  const { cluster, series, latest, coordinate, feature, stateName, blockNames, nearbyClusters } = context;
  const point: MapPoint[] = coordinate
    ? [{ id: cluster, ...coordinate, title: cluster, subtitle: `${formatVolume(latest.mscf)} · ${latest.month}`, kind: "flare" }]
    : [];
  const recent = series.slice(-12).map((row) => ({ month: String(row.month).slice(2), value: numberOrNull(row.mscf) ?? 0 }));
  const year2026 = series.filter((row) => row.month?.startsWith("2026")).reduce((sum, row) => sum + (numberOrNull(row.mscf) ?? 0), 0);
  const clusterPath = `/gas-flares/clusters/${encodeURIComponent(cluster)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}${clusterPath}/#webpage`,
        url: `${siteUrl}${clusterPath}`,
        name: `${cluster} Gas Flaring Data${stateName ? ` in ${stateName} State` : " in Nigeria"}`,
        description: `Monthly Nigeria Gas Flare Tracker observations for ${cluster}.`,
        isPartOf: { "@id": `${siteUrl}/#website` },
        spatialCoverage: stateName ? { "@type": "AdministrativeArea", name: `${stateName} State, Nigeria` } : { "@type": "Country", name: "Nigeria" },
      },
      {
        "@type": "Dataset",
        name: `${cluster} monthly gas flare observations`,
        description: `${formatNumber(series.length)} monthly observations from ${series[0].month} through ${latest.month}.`,
        url: `${siteUrl}${clusterPath}`,
        temporalCoverage: `${series[0].month}/${latest.month}`,
        spatialCoverage: coordinate ? { "@type": "Place", name: stateName ? `${stateName} State, Nigeria` : "Nigeria", geo: { "@type": "GeoCoordinates", latitude: coordinate.lat, longitude: coordinate.lng } } : undefined,
        creator: { "@id": `${siteUrl}/#organization` },
        isAccessibleForFree: true,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Gas flaring", item: `${siteUrl}/gas-flares` },
          { "@type": "ListItem", position: 2, name: "Clusters", item: `${siteUrl}/gas-flares?area=cluster` },
          { "@type": "ListItem", position: 3, name: cluster, item: `${siteUrl}${clusterPath}` },
        ],
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <section className="detail-hero"><div className="container"><div className="breadcrumbs"><Link href="/gas-flares">Gas flaring</Link> / Clusters / {cluster}</div><div className="detail-title"><div><span className="badge">Flare cluster</span><h1>Gas Flaring at {cluster}</h1><p>A tracker-defined cluster{stateName ? <> located in <Link href={`/places/states/${slugify(stateName)}`}>{stateName} State</Link></> : " in Nigeria"}. It is not interchangeable with a state, LGA or oil block.</p></div></div></div></section>
    <SourceRail label="Nigeria Gas Flare Tracker · cluster aggregation" observation={latest.month} retrieved={metadata.retrievedAt} />
    <div className="container page-pad">
      <div className="metric-grid" style={{ marginBottom: 22 }}><Metric label="Latest observation" value={formatDate(latest.month, { month: "long", year: "numeric" })} detail="Observation period"/><Metric label="Latest volume" value={formatVolume(latest.mscf)} detail="Tracker estimate"/><Metric label="2026 to latest" value={formatVolume(year2026)} detail="Jan through latest supplied month"/><Metric label="Observation coverage" value={formatNumber(series.length)} detail={`${formatDate(series[0].month, { month: "short", year: "numeric" })}–${formatDate(latest.month, { month: "short", year: "numeric" })}`}/></div>
      <section className="panel" style={{ marginBottom: 22 }}><div className="panel-head"><h2>What {cluster} represents</h2></div><div className="panel-body prose"><p>{cluster} is one of the geographic aggregations published by the Nigeria Gas Flare Tracker. SpillFlare has <strong>{formatNumber(series.length)} monthly observations</strong> for this cluster, covering {formatDate(series[0].month, { month: "long", year: "numeric" })} through {formatDate(latest.month, { month: "long", year: "numeric" })}.</p>{coordinate && <p>The tracker places the cluster at approximately {coordinate.lat.toFixed(4)}, {coordinate.lng.toFixed(4)}{stateName ? <> within {stateName} State</> : " outside a mapped state boundary"}. {blockNames.length ? <>Its coordinate falls inside {blockNames.map((block, index) => <span key={block}>{index ? ", " : ""}<Link href={`/oil-blocks/${slugify(block)}`}>{block}</Link></span>)} polygon data. Polygon overlap indicates geographic containment, not ownership or operational responsibility.</> : "No oil-block polygon contains the supplied cluster coordinate."}</p>}<p><Link href="/gas-flares">Compare all Nigerian gas flare areas</Link>{stateName ? <> or explore <Link href={`/places/states/${slugify(stateName)}`}>oil spill and gas flare records for {stateName}</Link></> : null}.</p></div></section>
      <div className="split"><div className="panel"><div className="panel-head"><h2>Cluster location</h2></div><NigeriaMap points={point} polygons={feature ? { type: "FeatureCollection", features: [feature] } : undefined} height={450} center={coordinate ? [coordinate.lat, coordinate.lng] : [5.3, 5.3]} zoom={10}/></div><div className="panel"><div className="panel-head"><h2>Monthly record</h2></div><div className="record-list">{series.slice(-8).reverse().map((row) => <div className="record-row" key={String(row.month)}><time>{row.month}</time><div><strong>{formatVolume(row.mscf)}</strong><p>Detected flaring estimate</p></div><span className="status">Supplied</span></div>)}</div></div></div>
      <div className="panel" style={{ marginTop: 22 }}><div className="panel-head"><h2>Recent trend</h2></div><div className="panel-body"><FlareTrend data={recent}/></div></div>
      {nearbyClusters.length > 0 && <section className="panel" style={{ marginTop: 22 }}><div className="panel-head"><h2>Nearby flare clusters</h2><span className="mono">Distance between tracker coordinates</span></div><div className="record-list">{nearbyClusters.map(({ row, distance }) => <Link className="record-row" href={`/gas-flares/clusters/${encodeURIComponent(row.name)}`} key={row.name}><time>{distance.toFixed(1)} km</time><div><strong>{row.name}</strong><p>{formatVolume(row.mscf)} · {row.month}</p></div><span className="status">Nearby</span></Link>)}</div></section>}
      <DataNote><strong>Cluster boundaries are tracker-defined.</strong> Nearby clusters and containing block polygons are geographic relationships calculated from supplied coordinates; they do not establish a shared operator or facility.</DataNote>
    </div>
  </>;
}
