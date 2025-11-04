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
  images: {
    domains: ['images.unsplash.com'],
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_APP_TYPE: 'isp-ops',
    NEXT_PUBLIC_PORTAL_TYPE: 'isp',
  },
  // Proxy API requests to backend for proper cookie handling
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001';
    const baseRewrites = [
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
  webpack: (config, { isServer }) => {
    config.resolve.alias = config.resolve.alias || {};
    try {
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
