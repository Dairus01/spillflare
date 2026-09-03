import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/*": ["./data/snapshots/**/*"] },
  images: { remotePatterns: [
    { protocol: "https", hostname: "oilspillmonitor.ng", pathname: "/data/attachments/**" },
    { protocol: "https", hostname: "nosdra.oilspillmonitor.ng", pathname: "/osm-2019/data/attachments/**" },
  ] },
};

export default nextConfig;
