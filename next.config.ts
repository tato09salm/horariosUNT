import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['pg'],
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
