import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-window'],
  // Server Actions are enabled by default in Next.js 14+
  experimental: {
    instrumentationHook: true,
  },
  images: {
    domains: ['images.unsplash.com'],
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  // Proxy API requests to backend for proper cookie handling
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
      {
        source: '/ready',
        destination: `${backendUrl}/ready`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = config.resolve.alias || {};
    try {
      // Ensure workspace packages resolve correctly when symlinked
      const sharedPackages = [
        '@dotmac/ui',
        '@dotmac/design-system',
        '@dotmac/providers',
        '@dotmac/http-client',
        '@dotmac/headless',
        '@dotmac/auth',
        '@dotmac/primitives',
      ];
      for (const pkg of sharedPackages) {
        config.resolve.alias[pkg] = require.resolve(pkg);
      }
    } catch (error) {
      // ignore alias errors in environments where packages are not yet installed
    }

    // Force react-window to use ES module build
    config.resolve.alias['react-window'] = require.resolve('react-window');
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.mts'],
      '.cjs': ['.cjs', '.cts'],
    };

    return config;
  },
};

export default nextConfig;
