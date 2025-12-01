import { createRequire } from 'module';
import bundleAnalyzer from '@next/bundle-analyzer';

const require = createRequire(import.meta.url);

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-window'],
  output: 'standalone',
  experimental: {
    instrumentationHook: false,
    externalDir: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Disable Next font optimization to avoid remote font fetch timeouts in CI/e2e
  optimizeFonts: false,
  images: {
    domains: ['images.unsplash.com'],
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env['NEXT_PUBLIC_API_BASE_URL'],
    NEXT_PUBLIC_WS_URL: process.env['NEXT_PUBLIC_WS_URL'],
    NEXT_PUBLIC_APP_TYPE: 'isp-ops',
    NEXT_PUBLIC_PORTAL_TYPE: 'isp',
  },
  // Proxy API requests to backend for proper cookie handling
  async rewrites() {
    // Use INTERNAL_API_URL for server-side rewrites (container-to-container)
    // Falls back to NEXT_PUBLIC_API_BASE_URL for local dev
    const backendUrl = process.env['INTERNAL_API_URL'] || process.env['NEXT_PUBLIC_API_BASE_URL'] || 'http://localhost:8000';
    const baseRewrites = [
      {
        source: '/api/v1/platform/:path*',
        destination: `${backendUrl}/api/platform/v1/admin/:path*`,
      },
      // ISP admin API
      {
        source: '/api/isp/v1/admin/:path*',
        destination: `${backendUrl}/api/isp/v1/admin/:path*`,
      },
      // ISP partner portal
      {
        source: '/api/isp/v1/partners/:path*',
        destination: `${backendUrl}/api/isp/v1/partners/:path*`,
      },
      // ISP customer portal
      {
        source: '/api/isp/v1/portal/:path*',
        destination: `${backendUrl}/api/isp/v1/portal/:path*`,
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

    const adminOnlyRoutes = [
      '/dashboard/data-transfer/:path*',
      '/dashboard/jobs/:path*',
      '/dashboard/integrations/:path*',
      '/dashboard/plugins/:path*',
      '/dashboard/feature-flags/:path*',
      '/dashboard/infrastructure/:path*',
      '/dashboard/security-access/:path*',
      '/dashboard/platform-admin/:path*',
    ].map((source) => ({
      source,
      destination: '/404',
    }));

    return [...baseRewrites, ...adminOnlyRoutes];
  },
  webpack: (config, { isServer, dir }) => {
    config.resolve.alias = config.resolve.alias || {};

    const path = require('path');

    // Ensure "@" maps to the app root for absolute imports
    config.resolve.alias['@'] = path.resolve(dir);

    // Add @shared alias for importing from shared directory
    config.resolve.alias['@shared'] = path.resolve(dir, '../../shared');

    try {
      const sharedPackages = [
        '@dotmac/ui',
        '@dotmac/design-system',
        '@dotmac/providers',
        '@dotmac/http-client',
        '@dotmac/headless',
        '@dotmac/primitives',
      ];
      for (const pkg of sharedPackages) {
        config.resolve.alias[pkg] = require.resolve(pkg);
      }
    } catch (error) {
      // ignore alias errors in environments where packages are not yet installed
    }

    config.resolve.alias['react-window'] = require.resolve('react-window');
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.mts'],
      '.cjs': ['.cjs', '.cts'],
    };

    // Optimize bundle splitting for better caching
    if (!isServer) {
      config.optimization = config.optimization || {};
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          apollo: {
            test: /[\\/]node_modules[\\/]@apollo[\\/]/,
            name: 'apollo',
            priority: 10,
            reuseExistingChunk: true,
          },
          radix: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'radix',
            priority: 9,
            reuseExistingChunk: true,
          },
          query: {
            test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
            name: 'tanstack',
            priority: 8,
            reuseExistingChunk: true,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 11,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };
    }

    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
