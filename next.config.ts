import type { NextConfig } from "next";

const basePath = '/juice';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: `${basePath}/`,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_GIST_AUTH_URL: process.env.NEXT_PUBLIC_GIST_AUTH_URL ?? '',
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
