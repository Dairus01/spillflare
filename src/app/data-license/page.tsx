import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, FileText, Scale } from "lucide-react";
import { DataNote } from "@/components/ui";

export const metadata: Metadata = {
  title: "Data License and Reuse",
  description:
    "Learn how SpillFlare handles reuse, attribution and licensing for its original analysis, visualizations and third-party oil spill and gas flare source records.",
  alternates: { canonical: "/data-license" },
  openGraph: {
    title: "Data License and Reuse | SpillFlare",
    description:
      "Reuse and attribution guidance for SpillFlare material and third-party environmental source records.",
    type: "website",
    url: "/data-license",
  },
};

export default function DataLicensePage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Provenance · attribution · reuse</span>
          <h1>Data License and Reuse</h1>
          <p>
            How to distinguish SpillFlare&apos;s original presentation and
            analysis from the third-party environmental records made
            searchable through the platform.
          </p>
        </div>
      </section>
      <div className="container page-pad">
        <DataNote>
          <strong>This page is a reuse and licensing notice, not a transfer of ownership.</strong>{" "}
          It does not grant rights over third-party material beyond the rights
          provided by its original source.
        </DataNote>
        <div className="prose" style={{ marginTop: 42 }}>
          <h2>What SpillFlare provides</h2>
          <p>
            SpillFlare provides searchable access, organization, mapping,
            visualization, aggregation and derived analysis of public
            environmental records relating to oil spills and gas flaring in
            Nigeria. Making a record easier to find or understand does not mean
            that SpillFlare owns the underlying record.
          </p>

          <h2>Underlying source records</h2>
          <p>
            Many records displayed by SpillFlare originate from third-party or
            public-sector providers, including the NOSDRA Oil Spill Monitor and
            the Nigeria Gas Flare Tracker. Ownership and reuse rights for those
            source records remain governed by their original providers.
          </p>
          <p>
            Any source-specific terms, notices, licences, attribution
            requirements or legal restrictions take precedence for the
            relevant material. SpillFlare does not grant broader rights over
            third-party records than it holds. The fact that a record is
            publicly accessible does not by itself establish that it is public
            domain or unrestricted for every use.
          </p>

          <h2>SpillFlare-created material</h2>
          <p>
            SpillFlare may create original page copy, aggregation logic,
            derived statistics, charts, visualizations, interface design,
            normalization and organization, explanatory summaries, and
            analytical output. These elements are distinct from ownership of
            the underlying source records.
          </p>
          <p>
            Unless a page or repository contains a specific licence notice,
            this policy does not apply a blanket open licence to
            SpillFlare-created material. No software licence is currently
            stated in this repository, and no software licence should be
            assumed to govern third-party datasets or records.
          </p>

          <h2>Attribution</h2>
          <p>
            When citing records found through SpillFlare, identify both
            SpillFlare as the platform used to access, organize or visualize
            the information and the original data provider shown on the
            relevant page. Preserve source notices and links where practical.
          </p>
          <div className="panel">
            <div className="panel-head"><h3>Suggested citation format</h3></div>
            <div className="panel-body mono">
              SpillFlare. “Nigeria Oil Spill and Gas Flare Records.”
              https://spillflare.com.ng. Accessed [access date]. Source records
              attributed to the original public data provider indicated on the
              relevant record or dataset page.
            </div>
          </div>

          <h2>Free access is not the same as unrestricted reuse</h2>
          <p>
            The Dataset structured-data value <code>isAccessibleForFree: true</code>{" "}
            means that people can access SpillFlare without payment. It does
            not mean that every underlying record is public domain, carries an
            open licence, or may be reused for every purpose without
            restriction.
          </p>

          <h2>Questions about reuse</h2>
          <p>
            For questions about attribution, reuse or the distinction between
            SpillFlare material and a source record, use the information on the{" "}
            <Link href="/about">About SpillFlare</Link> page. For detailed
            provenance and processing notes, read the{" "}
            <Link href="/data-and-methods">data and methods</Link> page.
          </p>
        </div>
        <div className="card-grid" style={{ marginTop: 54 }}>
          <Link className="card interactive" href="/data-and-methods">
            <div className="card-icon"><Database size={21} /></div>
            <h3>Data and methods</h3><p>Review source endpoints, definitions and handling of missing values.</p>
            <div className="card-meta"><span>Methodology</span><ArrowRight size={16} /></div>
          </Link>
          <Link className="card interactive" href="/about">
            <div className="card-icon"><FileText size={21} /></div>
            <h3>About SpillFlare</h3><p>Understand the platform&apos;s purpose and product principles.</p>
            <div className="card-meta"><span>About</span><ArrowRight size={16} /></div>
          </Link>
          <div className="card">
            <div className="card-icon"><Scale size={21} /></div>
            <h3>Source terms take precedence</h3><p>Check the original provider&apos;s terms before reusing third-party material.</p>
          </div>
        </div>
      </div>
    </>
  );
}
