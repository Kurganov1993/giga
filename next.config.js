/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['uuid', 'node-fetch', 'https-proxy-agent'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('https', 'http');
    }
    return config;
  }
}

module.exports = nextConfig