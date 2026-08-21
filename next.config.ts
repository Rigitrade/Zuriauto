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

  async redirects() {
    return [
      // The contract form now lives at /pickup/. Links to both earlier paths
      // were already sent to customers over WhatsApp, so they have to keep
      // working.
      //
      // Temporary rather than permanent on purpose: a 308 is cached hard by
      // browsers, and this path has been renamed more than once. Nothing is
      // gained from a permanent redirect here — the page is deliberately not
      // indexed, so there is no search ranking to preserve.
      {
        source: "/rental/pickup",
        destination: "/pickup",
        permanent: false,
      },
      {
        source: "/apply",
        destination: "/pickup",
        permanent: false,
      },
    ];
  },

  // Optional: Configure base path if deploying to subdirectory
  // basePath: '/your-subdirectory',

  // Optional: Configure asset prefix for CDN
  // assetPrefix: 'https://your-cdn-domain.com',
};

export default nextConfig;
