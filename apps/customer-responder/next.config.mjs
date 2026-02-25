/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    transpilePackages: ["@alpha/ui", "@alpha/core", "@alpha/security", "@alpha/sdk"],
    reactStrictMode: true,
    experimental: {
        serverComponentsExternalPackages: ["@lancedb/lancedb"],
    },
};

export default nextConfig;
