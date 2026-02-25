import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@alpha/ui", "@alpha/core", "@alpha/security", "@alpha/sdk"],
  reactStrictMode: true,
  basePath: "/processor",
};

export default nextConfig;
