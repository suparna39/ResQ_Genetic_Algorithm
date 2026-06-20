import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // MapLibre GL JS uses browser-only APIs; transpile it so Next.js doesn't
  // try to evaluate it on the server during the build step.
  transpilePackages: ['maplibre-gl'],
};

export default nextConfig;
