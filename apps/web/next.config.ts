import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@contractradar/shared', '@contractradar/authz'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
