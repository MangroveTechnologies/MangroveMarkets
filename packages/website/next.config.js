/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@mangrove-ai/sdk'],
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
