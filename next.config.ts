import type { NextConfig } from "next";

const basePath = '/juice';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: `${basePath}/`,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
