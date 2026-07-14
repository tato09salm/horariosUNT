import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['pg'],
  images: {
    unoptimized: true,
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/horarios/programaciones/:id/cursos',
        destination: '/api/horarios/programaciones/:id/programacion-cursos',
      },
    ];
  },
};

export default nextConfig;
