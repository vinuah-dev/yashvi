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

export default nextConfig;
