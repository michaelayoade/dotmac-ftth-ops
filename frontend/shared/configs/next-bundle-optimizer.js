/**
 * Next.js Bundle Optimization Configuration
 * Shared configuration for optimal bundle splitting, tree shaking, and performance
 */

const path = require("path");

/**
 * Advanced code splitting configuration
 */
const createCodeSplittingConfig = ({ isServer = false, isDev = false } = {}) => ({
  chunks: "all",
  minSize: isDev ? 10000 : 20000,
  maxSize: isDev ? 200000 : 244000,
  minChunks: 1,
  maxAsyncRequests: 30,
  maxInitialRequests: 30,
  enforceSizeThreshold: 50000,

  cacheGroups: {
    // Framework chunks (React, Next.js core)
    framework: {
      chunks: "all",
      name: "framework",
      test: /(?:react|react-dom|next)/,
      priority: 40,
      enforce: true,
    },

    // DotMac shared packages
    dotmacShared: {
      chunks: "all",
      name: "dotmac-shared",
      test: /[\\/]node_modules[\\/]@dotmac[\\/]/,
      priority: 35,
      enforce: true,
    },

    // UI libraries (Radix, Lucide, etc.)
    uiLibs: {
      chunks: "all",
      name: "ui-libs",
      test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|framer-motion)[\\/]/,
      priority: 30,
      enforce: true,
    },

    // Data visualization libraries
    dataViz: {
      chunks: "all",
      name: "data-viz",
      test: /[\\/]node_modules[\\/](recharts|d3|@visx)[\\/]/,
      priority: 25,
      enforce: true,
    },

    // Form and validation libraries
    forms: {
      chunks: "all",
      name: "forms",
      test: /[\\/]node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/,
      priority: 20,
      enforce: true,
    },

    // Date and utility libraries
    utils: {
      chunks: "all",
      name: "utils",
      test: /[\\/]node_modules[\\/](date-fns|lodash|clsx|class-variance-authority)[\\/]/,
      priority: 15,
      enforce: true,
    },

    // Large vendor libraries
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: "vendors",
      priority: 10,
      chunks: "all",
      reuseExistingChunk: true,
    },

    // Common application code
    common: {
      name: "common",
      minChunks: 2,
      priority: 5,
      chunks: "all",
      reuseExistingChunk: true,
    },

    // Styles
    styles: {
      name: "styles",
      type: "css/mini-extract",
      chunks: "all",
      enforce: true,
    },
  },
});

/**
 * Tree shaking optimization configuration
 */
const createTreeShakingConfig = ({ isDev = false } = {}) => ({
  // Enable tree shaking
  usedExports: true,
  sideEffects: false,

  // Mark specific packages as side-effect free
  sideEffects: [
    "*.css",
    "*.scss",
    "*.sass",
    "*.less",
    // Mark DotMac packages as side-effect free for better tree shaking
    "@dotmac/primitives",
    "@dotmac/headless",
    "@dotmac/styled-components",
    // UI libraries that are safe to tree shake
    "lucide-react",
    "@radix-ui/*",
    "class-variance-authority",
    "clsx",
  ],

  // Module concatenation
  concatenateModules: !isDev,

  // Minimize in production
  minimize: !isDev,
});

/**
 * Dynamic import optimization
 */
const createDynamicImportConfig = () => ({
  // Preload strategies
  preload: {
    // Critical components to preload
    critical: [
      "@dotmac/primitives/Button",
      "@dotmac/primitives/Input",
      "@dotmac/primitives/Dialog",
      "@dotmac/headless/LoadingSpinner",
    ],

    // Components to prefetch on interaction
    prefetch: [
      "@dotmac/primitives/DataTable",
      "@dotmac/primitives/Chart",
      "@dotmac/primitives/Calendar",
    ],
  },

  // Route-based splitting
  routes: {
    // Admin routes
    admin: {
      chunks: ["admin-common", "admin-specific"],
      preload: ["@dotmac/primitives/AdminLayout"],
    },

    // Customer portal routes
    customer: {
      chunks: ["customer-common", "customer-specific"],
      preload: ["@dotmac/primitives/CustomerLayout"],
    },

    // Billing routes (heavy with charts)
    billing: {
      chunks: ["billing-common", "data-viz"],
      preload: ["recharts", "@dotmac/primitives/BillingChart"],
    },
  },
});

/**
 * Bundle analyzer configuration
 */
const createBundleAnalyzerConfig = ({ enabled = false, mode = "static" } = {}) => ({
  analyzerMode: mode,
  analyzerPort: "auto",
  reportFilename: "../reports/bundle-analysis.html",
  openAnalyzer: false,
  generateStatsFile: true,
  statsFilename: "../reports/bundle-stats.json",
  logLevel: "info",
  enabled,
});

/**
 * Webpack optimization plugins
 */
const createWebpackOptimizations = ({ isDev = false, isServer = false }) => {
  const optimizations = [];

  // Ignore unused locales (moment.js, date-fns)
  if (!isServer) {
    const { IgnorePlugin } = require("webpack");
    optimizations.push(
      new IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      }),
      new IgnorePlugin({
        resourceRegExp: /^\.\/locales$/,
        contextRegExp: /date-fns$/,
      }),
    );
  }

  // Bundle analyzer in development
  if (isDev && process.env.ANALYZE === "true") {
    const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
    optimizations.push(
      new BundleAnalyzerPlugin(createBundleAnalyzerConfig({ enabled: true, mode: "server" })),
    );
  }

  return optimizations;
};

/**
 * Module federation configuration for micro-frontends
 */
const createModuleFederationConfig = ({ appName, shared = {} } = {}) => ({
  name: appName,
  filename: "remoteEntry.js",
  shared: {
    react: {
      singleton: true,
      requiredVersion: "^18.2.0",
    },
    "react-dom": {
      singleton: true,
      requiredVersion: "^18.2.0",
    },
    "next/router": {
      singleton: true,
    },
    "@dotmac/primitives": {
      singleton: true,
    },
    "@dotmac/headless": {
      singleton: true,
    },
    ...shared,
  },
});

/**
 * Performance budget configuration
 */
const createPerformanceBudget = () => ({
  // Asset size limits
  maxAssetSize: 250000, // 250KB
  maxEntrypointSize: 400000, // 400KB

  // Bundle size budgets by route type
  budgets: {
    initial: 200000, // 200KB for initial bundle
    async: 150000, // 150KB for async chunks
    vendor: 300000, // 300KB for vendor bundle
  },

  // Performance hints
  performance: {
    hints: process.env.NODE_ENV === "production" ? "error" : "warning",
    maxAssetSize: 250000,
    maxEntrypointSize: 400000,
    assetFilter: (assetFilename) => {
      return (
        !assetFilename.includes(".map") &&
        !assetFilename.includes("sw.js") &&
        !assetFilename.includes("workbox-")
      );
    },
  },
});

/**
 * Create optimized webpack configuration
 */
const createOptimizedWebpackConfig = (config, { dev, isServer, buildId }) => {
  // Apply tree shaking and code splitting
  if (!dev) {
    config.optimization = {
      ...config.optimization,
      ...createTreeShakingConfig({ isDev: dev }),
      splitChunks: createCodeSplittingConfig({ isServer, isDev: dev }),
    };

    // Apply performance budget
    const performanceBudget = createPerformanceBudget();
    config.performance = performanceBudget.performance;
  }

  // Add optimization plugins
  const optimizationPlugins = createWebpackOptimizations({
    isDev: dev,
    isServer,
  });
  config.plugins.push(...optimizationPlugins);

  // Optimize module resolution
  config.resolve.alias = {
    ...config.resolve.alias,
    // Alias for smaller bundles
    lodash: "lodash-es",
    // Resolve DotMac packages efficiently
    "@dotmac/primitives": path.resolve(__dirname, "../packages/primitives/src"),
    "@dotmac/headless": path.resolve(__dirname, "../packages/headless/src"),
    "@dotmac/styled-components": path.resolve(__dirname, "../packages/styled-components/src"),
  };

  // Module rules for better tree shaking
  config.module.rules.push({
    test: /\.js$/,
    include: /node_modules\/(lodash)/,
    sideEffects: false,
  });

  return config;
};

/**
 * Next.js experimental features for bundle optimization
 */
const createExperimentalConfig = () => ({
  // Optimize package imports
  optimizePackageImports: [
    "@dotmac/primitives",
    "@dotmac/headless",
    "@dotmac/styled-components",
    "lucide-react",
    "@radix-ui/react-icons",
    "react-hook-form",
    "date-fns",
    "lodash-es",
  ],

  // Server components for better code splitting
  serverComponentsExternalPackages: ["sharp", "onnxruntime-node"],

  // Enable modern bundling
  swcMinify: true,

  // Turbo mode optimizations
  turbo: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
});

/**
 * Bundle size monitoring utilities
 */
const createBundleSizeMonitor = () => ({
  // Size limits by chunk type
  limits: {
    framework: 150000, // 150KB
    "dotmac-shared": 100000, // 100KB
    "ui-libs": 200000, // 200KB
    "data-viz": 250000, // 250KB
    vendors: 300000, // 300KB
    common: 50000, // 50KB
  },

  // Monitoring script
  monitor: (stats) => {
    const chunks = stats.compilation.chunks;
    const warnings = [];

    chunks.forEach((chunk) => {
      const size = chunk.size();
      const limit = createBundleSizeMonitor().limits[chunk.name];

      if (limit && size > limit) {
        warnings.push(
          `Chunk "${chunk.name}" (${Math.round(size / 1000)}KB) exceeds limit (${Math.round(limit / 1000)}KB)`,
        );
      }
    });

    return warnings;
  },
});

module.exports = {
  createCodeSplittingConfig,
  createTreeShakingConfig,
  createDynamicImportConfig,
  createBundleAnalyzerConfig,
  createWebpackOptimizations,
  createModuleFederationConfig,
  createPerformanceBudget,
  createOptimizedWebpackConfig,
  createExperimentalConfig,
  createBundleSizeMonitor,
};
