import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Force network-first for app code & styles so a new deploy is never
  // shadowed by a stale cached bundle (this is what caused the production
  // "looks broken/old until cache clears" bug).
  runtimeCaching: [
    {
      urlPattern: /\.(?:js)$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "static-js-assets",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "static-style-assets",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-image-assets",
        expiration: { maxEntries: 64, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin,
      handler: "NetworkFirst",
      options: {
        cacheName: "others",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,

  // ─── Performance Optimizations ──────────────────────────────
  
  // Enable experimental optimizePackageImports for lucide-react and other heavy libs
  // This ensures only used icons are bundled, not the entire library
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "@supabase/supabase-js",
    ],
  },

  // ─── Image Optimization ─────────────────────────────────────
  images: {
    // If using Supabase Storage for profile images
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  // ─── Headers ────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/bgimages/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
