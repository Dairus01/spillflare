const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const siteUrl = (configuredSiteUrl || "https://spillflare.com.ng").replace(
  /\/$/,
  "",
);

export const siteName = "SpillFlare";
export const homeTitle = "Nigeria Oil Spill & Gas Flare Tracker | SpillFlare";
export const homeDescription =
  "Track oil spills and gas flaring across Nigeria. Explore interactive maps, incident records, operators, locations, trends and source-backed environmental data.";
