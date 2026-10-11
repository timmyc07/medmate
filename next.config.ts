import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
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
