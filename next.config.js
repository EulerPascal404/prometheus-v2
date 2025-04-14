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
        NODE_ENV: process.env.NODE_ENV,
    },
}

module.exports = nextConfig