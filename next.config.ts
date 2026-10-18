import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["falkordb", "@js-temporal/polyfill"],
};

export default nextConfig;
