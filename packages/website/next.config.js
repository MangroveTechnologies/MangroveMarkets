/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mangrove-ai/sdk'],
  images: {
    remotePatterns: [],
  },
  env: {
    NEXT_PUBLIC_MCP_SERVER_URL: process.env.MCP_SERVER_URL || 'http://localhost:8080',
  },
}

module.exports = nextConfig
