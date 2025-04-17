/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: [
            'localhost',
            'getprometheus.ai'
        ],
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    },
    // Use async rewrites to handle API requests
    async rewrites() {
        // Only apply rewrites in production and for non-API routes
        if (process.env.NODE_ENV === 'production') {
            return [
                {
                    source: '/api/validate-documents',
                    destination: '/api/validate-documents',
                },
                {
                    source: '/api/match-lawyer',
                    destination: '/api/match-lawyer',
                },
                {
                    source: '/api/document-status/:userId',
                    destination: '/api/document-status/:userId',
                }
            ];
        }
        // In development, don't rewrite API routes
        return [];
    },
    // Performance optimizations
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },
    experimental: {
        optimizePackageImports: ['@supabase/supabase-js', 'pdfjs-dist'],
    },
    webpack: (config, { dev, isServer }) => {
        // Optimize bundle size
        if (!dev && !isServer) {
            config.optimization = {
                ...config.optimization,
                minimize: true,
            };
        }
        return config;
    },
}

module.exports = nextConfig