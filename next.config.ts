import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ingen Cloudflare Images-bindning (gratisnivå); bilder levereras som de är
  images: { unoptimized: true },
  // cacheComponents/partialPrefetching (Next 16-mallens standard) hänger sig i Workers-runtimen
  // ("cannot guarantee … setTimeout()") → avstängt. Admin-appen är dynamisk ändå.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
