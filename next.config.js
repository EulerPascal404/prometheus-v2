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
    // Performance optimizations
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },
    experimental: {
        optimizePackageImports: ['@supabase/supabase-js', 'pdfjs-dist'],
    },
    rewrites: async () => {
        return [
            {
                source: '/api/test',
                destination: process.env.NODE_ENV === 'development' 
                    ? 'http://127.0.0.1:8000/api/test'
                    : '/api/test.py',
            },
            {
                source: '/api/validate-documents',
                destination: process.env.NODE_ENV === 'development'
                    ? 'http://127.0.0.1:8000/api/validate-documents'
                    : '/api/validate-documents.py',
            },
            {
                source: '/api/document-status/:user',
                destination: process.env.NODE_ENV === 'development'
                    ? 'http://127.0.0.1:8000/api/document-status/:user'
                    : '/api/document-status.py',
            },
            {
                source: '/api/match-lawyer',
                destination: process.env.NODE_ENV === 'development'
                    ? 'http://127.0.0.1:8000/api/match-lawyer'
                    : '/api/match-lawyer.py',
            },
            {
                source: '/api/:path*',
                destination: process.env.NODE_ENV === 'development'
                    ? 'http://127.0.0.1:8000/api/:path*'
                    : '/api/index.py',
            },
        ]
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