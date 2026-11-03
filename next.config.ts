import type { NextConfig } from "next";

const basePath = '';

const nextConfig: NextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_GIST_AUTH_URL: process.env.NEXT_PUBLIC_GIST_AUTH_URL ?? '',
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
