/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    transpilePackages: ["@alpha/ui", "@alpha/sdk", "@alpha/security"],
    experimental: {
        serverComponentsExternalPackages: ["@lancedb/lancedb"],
    },
};

export default nextConfig;
