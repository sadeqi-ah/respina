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
  experimental: {
    // Keep a visited dynamic page in the client router cache for 30s, so going back to the
    // customer list you just left is instant (Next otherwise waits for the server and skips the
    // list's loading UI). Safe here: dashboard server components render no per-user data (pages
    // load it on the client), and locale switch, sign-in and sign-out call router.refresh(),
    // which clears this cache.
    staleTimes: { dynamic: 30 },
  },
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
