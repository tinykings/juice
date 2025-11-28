import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // For GitHub Pages - change 'juice' to your repo name
  basePath: process.env.NODE_ENV === 'production' ? '/juice' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
