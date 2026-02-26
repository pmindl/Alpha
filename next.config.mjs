/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@alpha/ui", "@alpha/sdk", "@alpha/security"],
    experimental: {
        serverComponentsExternalPackages: ["@lancedb/lancedb"],
    },
};

export default nextConfig;
