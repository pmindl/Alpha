/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@alpha/ui", "@alpha/sdk", "@alpha/security", "@alpha/google-auth"],
    experimental: {
        serverComponentsExternalPackages: ["@lancedb/lancedb"],
    },
};

export default nextConfig;
