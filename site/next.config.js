/** @type {import('next').NextConfig} */

const securityHeaders = [
    {
        key: "X-Frame-Options",
        value: "DENY",
    },
    {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
    },
    {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
    },
    {
        key: "X-XSS-Protection",
        value: "1; mode=block",
    },
    {
        key: "X-Content-Type-Options",
        value: "nosniff",
    },
];

const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    env: {
        API_BASE_URL: process.env.API_BASE_URL,
        MAP_BOX_ACCESS_TOKEN: process.env.MAP_BOX_ACCESS_TOKEN,
        DOMAIN_NAME: process.env.DOMAIN_NAME,
        SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
        SUPPORT_PHONE: process.env.SUPPORT_PHONE,
    },
    headers() {
        return [
            {
                source: "/:path*",
                headers: securityHeaders,
            },
        ];
    },
    transpilePackages: ["@create-disruptions-data/shared-ts"],
    pageExtensions: ["page.tsx", "page.ts", "page.jsx", "page.js", "api.tsx", "api.ts", "api.jsx", "api.js"],
    eslint: {
        ignoreDuringBuilds: true,
    },
};

module.exports = nextConfig;
