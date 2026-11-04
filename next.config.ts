import type { NextConfig } from "next";

const basePath = '';

const nextConfig: NextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_GIST_AUTH_URL: process.env.NEXT_PUBLIC_GIST_AUTH_URL ?? '',
  },
  // The dev badge covers app controls in every corner; build errors still show.
  devIndicators: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
