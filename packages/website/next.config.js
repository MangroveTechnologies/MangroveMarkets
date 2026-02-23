/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mangrovemarkets/sdk'],
  images: {
    domains: [],
  },
  env: {
    NEXT_PUBLIC_MCP_SERVER_URL: process.env.MCP_SERVER_URL || 'http://localhost:8080',
  },
}

module.exports = nextConfig
