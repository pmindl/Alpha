import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@alpha/ui"],
  basePath: "/invoice",
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
