/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
    transpilePackages: ["@alpha/ui", "@alpha/sdk", "@alpha/security", "@alpha/google-auth"],
    experimental: {
        serverComponentsExternalPackages: ["@lancedb/lancedb"],
    },
};

export default nextConfig;
