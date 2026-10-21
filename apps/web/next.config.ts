import "@sanity-ui-animations/env/client";
import "@sanity-ui-animations/env/server";

import { env } from "@sanity-ui-animations/env/client";
import { client } from "@sanity-ui-animations/sanity/client";
import { queryRedirects } from "@sanity-ui-animations/sanity/query";
import type { NextConfig } from "next";
import { sanity } from "next-sanity/live/cache-life";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@sanity-ui-animations/ui",
    "@sanity-ui-animations/sanity-blocks",
    "@sanity-ui-animations/ui-animations",
  ],
  reactCompiler: true,
  cacheComponents: true,
  cacheLife: { default: sanity },
  experimental: {
    inlineCss: true,
    turbopackRustReactCompiler: true,
  },
  logging: {
    fetches: {},
  },
  images: {
    minimumCacheTTL: 31_536_000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: `/images/${env.NEXT_PUBLIC_SANITY_PROJECT_ID}/**`,
      },
    ],
  },
  async redirects() {
    const redirects = await client.fetch(queryRedirects);
    return redirects.map((redirect) => ({
      source: redirect.source,
      destination: redirect.destination,
      permanent: redirect.permanent ?? false,
    }));
  },
};

export default nextConfig;
