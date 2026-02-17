import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@alpha/ui"],
  basePath: "/invoice",
};

export default nextConfig;
