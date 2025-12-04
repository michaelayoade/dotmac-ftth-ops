/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // Customer portal specific environment
  env: {
    NEXT_PUBLIC_APP_TYPE: 'isp-customer',
    NEXT_PUBLIC_PORTAL_TYPE: 'customer',
  },

  // Transpile workspace packages
  transpilePackages: [
    '@dotmac/ui',
    '@dotmac/primitives',
  ],

  // API rewrites - only customer portal endpoints
  async rewrites() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

    return [
      // Customer portal API endpoints
      {
        source: '/api/isp/v1/portal/:path*',
        destination: `${apiBaseUrl}/api/isp/v1/portal/:path*`,
      },
      // Customer authentication endpoints
      {
        source: '/api/isp/v1/auth/customer/:path*',
        destination: `${apiBaseUrl}/api/isp/v1/auth/customer/:path*`,
      },
      // Customer-specific endpoints
      {
        source: '/api/isp/v1/customer/:path*',
        destination: `${apiBaseUrl}/api/isp/v1/customer/:path*`,
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Add aliases for shared packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': new URL('./app', import.meta.url).pathname.replace(/^\//, ''),
    };

    return config;
  },

  // Images configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
