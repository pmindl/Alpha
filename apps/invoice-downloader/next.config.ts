import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@alpha/ui"],
  basePath: "/invoice",
};

export default nextConfig;
