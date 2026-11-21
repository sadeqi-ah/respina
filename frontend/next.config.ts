import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained server bundle for the container image (Task 2.8).
  output: "standalone",
  // Cache Components is off on purpose (ADR-011): every page is per-user and the root layout
  // reads the NEXT_LOCALE cookie for <html lang dir>, so there is no static shell to prerender.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
