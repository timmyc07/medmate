import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  images: {
    qualities: [55, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mcp.fda.gov.tw",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
