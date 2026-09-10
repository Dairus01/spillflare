import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/*": ["./data/snapshots/**/*"] },
  async headers() {
    const publicSnapshotCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    ];
    return [
      "/api/spills",
      "/api/spills/:path*",
      "/api/flares",
      "/api/geo",
      "/api/search",
      "/api/export",
    ].map((source) => ({ source, headers: publicSnapshotCache }));
  },
  async redirects() {
    return [
      {
        source: "/gas-flaring",
        destination: "/gas-flares",
        permanent: true,
      },
    ];
  },
  images: { remotePatterns: [
    { protocol: "https", hostname: "oilspillmonitor.ng", pathname: "/data/attachments/**" },
    { protocol: "https", hostname: "nosdra.oilspillmonitor.ng", pathname: "/osm-2019/data/attachments/**" },
  ] },
};

export default nextConfig;
