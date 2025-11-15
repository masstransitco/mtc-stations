/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignore TypeScript errors in scripts folder during production build
    ignoreBuildErrors: false,
  },
  // Exclude scripts from being processed
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'stream-chain': 'stream-chain',
      });
    }
    return config;
  },
}

module.exports = nextConfig
