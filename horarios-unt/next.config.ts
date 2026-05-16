import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['pg'],
};

export default nextConfig;
