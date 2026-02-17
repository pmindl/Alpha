import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@alpha/ui"],
  async rewrites() {
    return [
      {
        source: "/invoice",
        destination: "http://localhost:3001/invoice",
      },
      {
        source: "/invoice/:path*",
        destination: "http://localhost:3001/invoice/:path*",
      },
      {
        source: "/processor/:path*",
        destination: "http://localhost:3002/processor/:path*",
      },
    ];
  },
};

export default nextConfig;
