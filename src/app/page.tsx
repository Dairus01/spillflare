import Link from "next/link";
import { ArrowRight, Database, Flame, Map, Search, Waves } from "lucide-react";
import { NigeriaMap } from "@/components/map";
import {
  flarePeriod,
  getGeo,
  getLatestSpills,
  getMetadata,
  getSpills,
  spillCoordinates,
} from "@/lib/data";
import {
  formatDate,
  formatNumber,
  formatVolume,
  numberOrNull,
  spillPath,
  stateCodes,
} from "@/lib/format";
import { SectionHeading, SourceRail } from "@/components/ui";
import type { MapPoint } from "@/types/domain";
import type { Metadata } from "next";
import { datasetLicense, homeDescription, homeTitle, siteUrl } from "@/lib/site";
import { parseW3cDate, trustedIncidentYear } from "@/lib/sitemap-date";

export const metadata: Metadata = {
  title: { absolute: homeTitle },
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: homeTitle,
    description: homeDescription,
  },
};

export default async function Home() {
  const [metadata, latestSpills, allSpills, stateFlares, states] =
    await Promise.all([
      getMetadata(),
      getLatestSpills(180),
      getSpills(),
      flarePeriod("state"),
      getGeo("states"),
    ]);
  const retrievedAt = parseW3cDate(metadata.retrievedAt);
  const spills2026 = allSpills.filter((row) =>
    trustedIncidentYear(row, retrievedAt) === "2026",
  );
  const mappedSpills: MapPoint[] = latestSpills.flatMap((row) => {
    const c = spillCoordinates(row);
    return c
      ? [
          {
            id: row.id,
            ...c,
            title: `Spill ${row.incidentnumber ?? row.id}`,
            subtitle: row.sitelocationname,
            kind: "spill" as const,
            href: spillPath(row.id),
          },
        ]
      : [];
  });
  const flarePoints: MapPoint[] = stateFlares.flatMap((row) => {
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
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/#webpage`,
        url: siteUrl,
        name: homeTitle,
        description: homeDescription,
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: [
          { "@type": "Thing", name: "Oil spills in Nigeria" },
          { "@type": "Thing", name: "Gas flaring in Nigeria" },
        ],
      },
      {
        "@type": "Dataset",
        "@id": `${siteUrl}/#environmental-records`,
        name: "Nigeria oil spill and gas flare public records",
        description: homeDescription,
        url: siteUrl,
        spatialCoverage: { "@type": "Place", name: "Nigeria" },
        creator: { "@id": `${siteUrl}/#organization` },
        isAccessibleForFree: true,
        ...datasetLicense,
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is SpillFlare?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "SpillFlare is an open search and mapping tool for Nigeria's public NOSDRA oil-spill records and Nigeria Gas Flare Tracker data.",
            },
          },
          {
            "@type": "Question",
            name: "Where does SpillFlare's data come from?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Oil-spill records come from the cited NOSDRA dataset. Gas-flare estimates come from cited Nigeria Gas Flare Tracker snapshots.",
            },
          },
          {
            "@type": "Question",
            name: "Does missing data mean zero?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Missing quantities, flare rows and locations are shown as not supplied and are never converted to zero.",
            },
          },
        ],
      },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <SourceRail
        label="Sources checked · NOSDRA + Nigeria Gas Flare Tracker"
        observation="2026-08-23"
        retrieved={metadata.retrievedAt}
      />
      <section className="hero home-hero">
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <span className="eyebrow">Nigeria · Open environmental data</span>
            <h1>Nigeria Oil Spill &amp; Gas Flare Tracker</h1>
            <p>
              Track oil spills and gas flaring across Nigeria through
              searchable incident records, interactive maps and monthly flare
              estimates, with every source, date and limitation kept visible.
            </p>
            <form className="hero-search" action="/search">
              <Search
                size={19}
                color="#607077"
                style={{ margin: "12px 0 0 10px" }}
              />
              <input
                name="q"
                aria-label="Search Nigeria environmental records"
                placeholder="Search a place, spill record or oil block…"
              />
              <button>Search</button>
            </form>
            <div className="hero-actions">
              <Link className="button" href="/explore">
                <Map size={17} />
                Explore Nigeria
              </Link>
              <Link className="button secondary" href="/oil-spills">
                Browse oil-spill records
                <ArrowRight size={17} />
              </Link>
            </div>
            <div className="home-stats">
              <div>
                <strong>
                  {formatNumber(metadata.sources.spillsPrimary.count)}
                </strong>
                <span>spill records in current retrieval</span>
              </div>
              <div>
                <strong>{formatNumber(spills2026.length)}</strong>
                <span>valid 2026 incident dates</span>
              </div>
              <div>
                <strong>{formatNumber(flarePoints.length)}</strong>
                <span>states with flare detections in May 2026</span>
              </div>
            </div>
          </div>
          <div className="home-map">
            <NigeriaMap
              points={[...mappedSpills, ...flarePoints]}
              polygons={states}
              height={570}
              center={[5.3, 6.3]}
              zoom={7}
            />
            <div className="map-choice">
              <span className="eyebrow">Choose what to explore</span>
              <Link href="/oil-spills">
                <i className="spill-dot" />
                Oil-spill records
                <ArrowRight size={14} />
              </Link>
              <Link href="/gas-flares">
                <i className="flare-dot" />
                Gas-flare estimates
                <ArrowRight size={14} />
              </Link>
              <Link href="/places">
                <Map size={13} />
                Places across Nigeria
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <SectionHeading title="Start with the question you have" />
          <div className="card-grid">
            <Link className="card interactive" href="/oil-spills">
              <div className="card-icon">
                <Waves size={21} />
              </div>
              <h3>Where have spills been recorded?</h3>
              <p>
                Map and search every oil-spill record with source fields and
                official evidence links.
              </p>
              <div className="card-meta">
                <span>NOSDRA records</span>
                <ArrowRight size={16} />
              </div>
            </Link>
            <Link className="card interactive" href="/gas-flares">
              <div className="card-icon">
                <Flame size={21} />
              </div>
              <h3>Where has flaring been detected?</h3>
              <p>
                Compare state, LGA, cluster, block and onshore/offshore
                estimates independently.
              </p>
              <div className="card-meta">
                <span>Through May 2026</span>
                <ArrowRight size={16} />
              </div>
            </Link>
            <Link className="card interactive" href="/places">
              <div className="card-icon">
                <Map size={21} />
              </div>
              <h3>What do the sources say about a place?</h3>
              <p>
                Separate spill and flare views for any Nigerian state, with
                every time period identified.
              </p>
              <div className="card-meta">
                <span>State profiles</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          </div>
        </div>
      </section>
      <section className="section alt">
        <div className="container">
          <SectionHeading
            eyebrow="Latest oil spill records"
            title="Recent reports from the source"
            body="Dates below are observation dates in the dataset, not the date this website retrieved the data."
            action={{ label: "See all oil spills", href: "/oil-spills" }}
          />
          <div className="panel record-list">
            {latestSpills.slice(0, 5).map((spill) => (
              <Link
                className="record-row"
                key={spill.id}
                href={`/oil-spills/${spill.incidentnumber ?? spill.id}`}
              >
                <time>
                  {formatDate(spill.incidentdate, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                <div>
                  <strong>
                    {spill.sitelocationname ?? "Location not supplied"}
                  </strong>
                  <p>
                    {spill.company ?? "Company not supplied"} ·{" "}
                    {spill.lga ?? "LGA not supplied"},{" "}
                    {stateCodes[spill.statesaffected ?? ""] ??
                      spill.statesaffected ??
                      "State not supplied"}
                  </p>
                </div>
                <span className="status">{spill.status ?? "Recorded"}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Understand the data"
            title="Know exactly what each number means"
            body="We preserve source gaps, distinguish observation dates from retrieval dates, and explain why some geographic or historical views are limited."
          />
          <div className="card-grid">
            <div className="card">
              <div className="card-icon">
                <Database size={21} />
              </div>
              <h3>Source-backed</h3>
              <p>
                Every major view identifies the public endpoint and its latest
                available observation.
              </p>
            </div>
            <div className="card">
              <div className="card-icon">
                <Flame size={21} />
              </div>
              <h3>Geographies stay separate</h3>
              <p>
                A state is not a block or a cluster. Comparisons are made within
                the selected geography level.
              </p>
            </div>
            <div className="card">
              <div className="card-icon">
                <Search size={21} />
              </div>
              <h3>Missing stays missing</h3>
              <p>
                Unknown quantities and absent fields are labelled clearly. They
                are never silently converted to zero.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="section alt">
        <div className="container">
          <SectionHeading
            eyebrow="SpillFlare answers"
            title="Questions about Nigeria&apos;s environmental records"
          />
          <div className="faq">
            <details>
              <summary>What is SpillFlare?</summary>
              <p>SpillFlare is an open search and mapping tool for Nigeria&apos;s public NOSDRA oil-spill records and Nigeria Gas Flare Tracker data.</p>
            </details>
            <details>
              <summary>Where does SpillFlare&apos;s data come from?</summary>
              <p>Oil-spill records come from the cited NOSDRA dataset. Gas-flare estimates come from the cited Nigeria Gas Flare Tracker snapshots. Each page identifies its source and retrieval date.</p>
            </details>
            <details>
              <summary>Does missing data mean zero?</summary>
              <p>No. A missing quantity, flare row or location is shown as not supplied and is never converted to zero.</p>
            </details>
            <details>
              <summary>How current is the gas-flare data?</summary>
              <p>Coverage depends on the source snapshot and is shown on each view. Company flare data is historical and ends in October 2020.</p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
