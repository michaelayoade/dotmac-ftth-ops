import { createRequire } from 'module';
import bundleAnalyzer from '@next/bundle-analyzer';

const require = createRequire(import.meta.url);

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const sharedPackageAliases = {
  '@shared': '../../shared',
  '@dotmac/ui': '../../shared/packages/ui/src',
  '@dotmac/primitives': '../../shared/packages/primitives/src',
  '@dotmac/headless': '../../shared/packages/headless/src',
  '@dotmac/features': '../../shared/packages/features/src',
  '@dotmac/graphql': '../../shared/packages/graphql/src',
  '@dotmac/graphql/generated': '../../shared/packages/graphql/generated',
  '@dotmac/http-client': '../../shared/packages/http-client/src',
  '@dotmac/design-system': '../../shared/packages/design-system/src',
  '@dotmac/providers': '../../shared/packages/providers/src',
};

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'react-window',
    '@dotmac/ui',
    '@dotmac/primitives',
    '@dotmac/headless',
    '@dotmac/features',
    '@dotmac/graphql',
    '@dotmac/http-client',
    '@dotmac/design-system',
    '@dotmac/providers',
  ],
  output: 'standalone',
  experimental: {
    instrumentationHook: false,
    externalDir: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['images.unsplash.com'],
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_APP_TYPE: 'platform-admin',
    NEXT_PUBLIC_PORTAL_TYPE: 'admin',
  },
  // Proxy API requests to backend for proper cookie handling
  async rewrites() {
    // Use INTERNAL_API_URL for server-side rewrites (container-to-container)
    // Falls back to NEXT_PUBLIC_API_BASE_URL for local dev
    const backendUrl = process.env['INTERNAL_API_URL'] || process.env['NEXT_PUBLIC_API_BASE_URL'] || 'http://localhost:8001';
    return [
      {
        source: '/api/v1/platform/:path*',
        destination: `${backendUrl}/api/platform/v1/admin/:path*`,
      },
      {
        source: '/api/platform/v1/admin/:path*',
        destination: `${backendUrl}/api/platform/v1/admin/:path*`,
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
  webpack: (config, { isServer, dir }) => {
    config.resolve.alias = config.resolve.alias || {};

    const path = require('path');

    // Ensure "@" maps to the app root for absolute imports
    config.resolve.alias['@'] = path.resolve(dir);

    for (const [pkg, relativePath] of Object.entries(sharedPackageAliases)) {
      config.resolve.alias[pkg] = path.resolve(dir, relativePath);
    }

    // Ensure generated GraphQL helpers resolve to the source files
    const graphqlGeneratedDir = path.resolve(dir, '../../shared/packages/graphql/generated');
    config.resolve.alias['@dotmac/graphql/generated'] = graphqlGeneratedDir;
    config.resolve.alias['@dotmac/graphql/generated/react-query$'] = path.resolve(
      graphqlGeneratedDir,
      'react-query.ts',
    );

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
