import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/processor",
  transpilePackages: ["@alpha/ui", "@alpha/sdk"],
};

export default nextConfig;
