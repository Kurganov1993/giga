/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['https', 'uuid'],
  },
}

module.exports = nextConfig