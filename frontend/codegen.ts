import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * GraphQL Code Generator Configuration
 *
 * Generates TypeScript types and TanStack Query hooks from:
 * - GraphQL schema exported from Strawberry backend
 * - GraphQL operation documents (.graphql files) in both apps
 *
 * Output: shared/packages/graphql/generated/
 * Both apps import from this shared location to avoid drift.
 *
 * Run: pnpm graphql:codegen
 */
const config: CodegenConfig = {
  // Use committed schema snapshot for deterministic builds (SDL format)
  schema: './graphql-schema.graphql',

  // Search for .graphql files in both apps
  documents: [
    'apps/platform-admin-app/lib/graphql/**/*.graphql',
    'apps/isp-ops-app/lib/graphql/**/*.graphql',
  ],

  // Output to shared package
  generates: {
    './shared/packages/graphql/generated/': {
      // Use the client preset for optimal output
      preset: 'client',

      plugins: [],

      config: {
        // Type-safety improvements
        useTypeImports: true,
        strictScalars: true,

        // Scalar mappings (adjust based on backend)
        scalars: {
          DateTime: 'string',
          Date: 'string',
          JSON: 'Record<string, any>',
          UUID: 'string',
          Decimal: 'string',
        },

        // Don't generate unused types
        skipTypename: false,

        // Enum handling
        enumsAsTypes: false,
      },
    },

    // Generate React Query hooks
    './shared/packages/graphql/generated/react-query.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-query',
      ],

      config: {
        // Use our shared fetcher
        fetcher: {
          func: '@dotmac/graphql#graphqlFetcher',
          isReactHook: false,
        },

        // TanStack Query options
        exposeFetcher: true,
        exposeQueryKeys: true,
        addInfiniteQuery: true,

        // Type-safety improvements
        useTypeImports: true,
        strictScalars: true,

        scalars: {
          DateTime: 'string',
          Date: 'string',
          JSON: 'Record<string, any>',
          UUID: 'string',
          Decimal: 'string',
        },

        // Hook naming
        operationResultSuffix: 'Result',
        dedupeFragments: true,
      },
    },
  },

  // General settings
  config: {
    // Prevent optional fields from being nullable
    maybeValue: 'T | null | undefined',
  },

  // Watch mode options
  watch: false,

  // Logging
  verbose: true,

  // Overwrite existing files
  overwrite: true,

  // Hooks for custom processing
  hooks: {
    afterAllFileWrite: [
      // Run prettier on generated files
      'prettier --write',
    ],
  },
};

export default config;
