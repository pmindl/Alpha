import sharedConfig from "@alpha/ui/tailwind.config";

const config = {
    ...sharedConfig,
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
        "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    ],
};

export default config;
