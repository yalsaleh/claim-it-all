import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: include workspace packages in file tracing for the production image.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@contractradar/shared',
    '@contractradar/authz',
    '@contractradar/platform',
    '@contractradar/contract-rules',
    '@contractradar/event-detection',
    '@contractradar/notice-drafting',
    '@contractradar/notice-delivery',
    '@contractradar/connectors',
    '@contractradar/operations',
  ],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
