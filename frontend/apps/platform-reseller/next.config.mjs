/** @type {import('next').NextConfig} */

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  transpilePackages: ["@dotmac/ui", "@dotmac/primitives"],

  async rewrites() {
    return [
      // Platform partner portal API routes
      {
        source: "/api/platform/v1/partners/portal/:path*",
        destination: `${apiBaseUrl}/api/platform/v1/partners/portal/:path*`,
      },
      // Platform partner auth routes
      {
        source: "/api/platform/v1/auth/partner/:path*",
        destination: `${apiBaseUrl}/api/platform/v1/auth/partner/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
