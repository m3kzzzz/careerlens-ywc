import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // "Dates" was replaced by "My Calendar".
  async redirects() {
    return [{ source: "/dates", destination: "/calendar", permanent: true }];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
