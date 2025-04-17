/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: [
            'localhost',
            'prometheus-ai-backend.herokuapp.com',
            'prometheus-ai-backend-app-589cbe98fdc3.herokuapp.com'
        ],
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    },
    // Use async rewrites to handle API requests
    async rewrites() {
        return [
            {
                source: '/api/validate-documents',
                destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://prometheus-ai-backend.herokuapp.com'}/api/validate-documents`,
            },
            {
                source: '/api/match-lawyer',
                destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://prometheus-ai-backend.herokuapp.com'}/api/match-lawyer`,
            },
            {
                source: '/api/:path*',
                destination: process.env.NODE_ENV === 'development' 
                    ? 'http://localhost:8000/api/:path*' 
                    : `${process.env.NEXT_PUBLIC_API_URL || 'https://prometheus-ai-backend.herokuapp.com'}/api/:path*`,
            },
        ];
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