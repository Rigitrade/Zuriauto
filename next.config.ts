import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export
  output: "export",

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Optional: Add trailing slash for better compatibility
  trailingSlash: true,

  // Optional: Configure base path if deploying to subdirectory
  // basePath: '/your-subdirectory',

  // Optional: Configure asset prefix for CDN
  // assetPrefix: 'https://your-cdn-domain.com',
};

export default nextConfig;
