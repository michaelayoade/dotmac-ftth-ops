import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: {
    [process.env.GRAPHQL_SCHEMA_URL || 'http://localhost:8000/api/v1/graphql']: {
      headers: {
        'X-Tenant-ID': process.env.GRAPHQL_TENANT_ID || 'tenant-default',
        'Content-Type': 'application/json',
      },
    },
  },
  documents: ['app/**/*.graphql', 'lib/graphql/**/*.graphql'],
  generates: {
    'lib/graphql/generated.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-apollo',
      ],
      config: {
        withHooks: true,
        withComponent: false,
        withHOC: false,
        skipTypename: false,
        enumsAsTypes: true,
        avoidOptionals: {
          field: false,
          inputValue: false,
          object: false,
        },
        scalars: {
          DateTime: 'string',
          BigInt: 'number',
          Decimal: 'number',
        },
      },
    },
  },
};

export default config;
