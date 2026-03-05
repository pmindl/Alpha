/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    transpilePackages: ["@alpha/ui", "@alpha/sdk", "@alpha/security", "@alpha/google-auth"],
    experimental: {
        serverComponentsExternalPackages: ["@lancedb/lancedb"],
    },
};

export default nextConfig;
