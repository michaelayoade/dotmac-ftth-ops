/** @type {import('next').NextConfig} */

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  transpilePackages: ["@dotmac/ui", "@dotmac/primitives"],

  async rewrites() {
    return [
      // Platform tenant portal API routes
      {
        source: "/api/platform/v1/billing/tenant/:path*",
        destination: `${apiBaseUrl}/api/platform/v1/billing/tenant/:path*`,
      },
      // Tenant auth routes
      {
        source: "/api/platform/v1/auth/tenant/:path*",
        destination: `${apiBaseUrl}/api/platform/v1/auth/tenant/:path*`,
      },
      // Tenant management routes
      {
        source: "/api/platform/v1/tenants/:path*",
        destination: `${apiBaseUrl}/api/platform/v1/tenants/:path*`,
      },
      // Usage billing routes
      {
        source: "/api/platform/v1/usage/:path*",
        destination: `${apiBaseUrl}/api/platform/v1/usage/:path*`,
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
