import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DataAssistant } from "@/components/data-assistant";
import { homeDescription, siteName, siteUrl } from "@/lib/site";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", weight: ["400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "SpillFlare", template: "%s · SpillFlare" },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  description: homeDescription,
  keywords: ["Nigeria oil spills", "Nigeria gas flares", "NOSDRA spill records", "Gas Flare Tracker", "environmental data Nigeria"],
  applicationName: siteName,
  authors: [{ name: "Dairus" }],
  creator: "Dairus",
  publisher: "Dairus",
  openGraph: {
    type: "website",
    siteName: "SpillFlare",
    title: "SpillFlare | Nigeria oil spill and gas flare records",
    description: "Search and understand Nigeria's public oil spill and gas flare records with sources, dates and limitations visible.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "SpillFlare | Nigeria oil spill and gas flare records",
    description: "Search and understand Nigeria's public oil spill and gas flare records.",
  },
};

// Live source snapshots are refreshed before `npm start`. Rendering at request
// time ensures the refreshed files are used instead of a build-time copy.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: siteName,
        url: siteUrl,
        logo: `${siteUrl}/icon.svg`,
        founder: { "@type": "Person", name: "Dairus" },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteName,
        url: siteUrl,
        description: "Searchable public records of Nigeria's oil spills and gas flares.",
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  return <html lang="en" suppressHydrationWarning><head><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /></head><body className={`${manrope.variable} ${plexMono.variable}`}><ThemeProvider><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader /><main id="main-content">{children}</main><SiteFooter /><DataAssistant /></ThemeProvider></body></html>;
}
