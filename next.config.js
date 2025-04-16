/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: [
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
                source: '/api/:path*',
                destination: process.env.NODE_ENV === 'development' 
                    ? 'http://localhost:8000/api/:path*' 
                    : '/api/:path*',
            },
        ];
    },
}

module.exports = nextConfig