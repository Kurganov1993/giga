/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['axios', 'https', 'uuid'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('axios', 'https');
    }
    return config;
  }
}

module.exports = nextConfig;