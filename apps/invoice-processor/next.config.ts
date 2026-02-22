import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/processor",
  transpilePackages: ["@alpha/ui", "@alpha/sdk"],
};

export default nextConfig;
