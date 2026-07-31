import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `output: "export"`. A static export cannot contain route handlers, and
  // the booking form needs one to send mail on Vercel, which has no PHP
  // runtime. Vercel builds and serves this natively.
  //
  // Consequence: `npm run build` no longer produces an `out/` folder. Deploying
  // by uploading static files is no longer possible without reinstating this
  // setting, which would break /api/send-booking.

  // Left in place: switching it off would start routing images through
  // Vercel's optimizer, which is a separate change from this one.
  images: {
    unoptimized: true,
  },

  // Keeps URLs as /GTC/ and /book/, matching the deployed site.
  trailingSlash: true,

  // Optional: Configure base path if deploying to subdirectory
  // basePath: '/your-subdirectory',

  // Optional: Configure asset prefix for CDN
  // assetPrefix: 'https://your-cdn-domain.com',
};

export default nextConfig;
