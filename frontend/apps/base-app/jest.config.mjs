import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@dotmac/headless/utils$': '<rootDir>/__mocks__/headless-utils.js',
    '^@dotmac/ui$': '<rootDir>/__mocks__/ui.js',
    '^@dotmac/design-system$': '<rootDir>/__mocks__/design-system.js',
    '^@dotmac/providers$': '<rootDir>/__mocks__/providers.js',
    '^@dotmac/auth$': '<rootDir>/__mocks__/auth.js',
    '^@dotmac/http-client$': '<rootDir>/__mocks__/http-client.js',
    '^@dotmac/headless$': '<rootDir>/__mocks__/headless.js',
    '^@dotmac/notifications$': '<rootDir>/__mocks__/notifications.js',
    '^@dotmac/primitives$': '<rootDir>/__mocks__/primitives.js',
    '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(msw)/)',
  ],
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/e2e/',
    '__tests__/types/',
    '__tests__/a11y/setup.ts',
    '__tests__/mocks/server.ts',
    '__tests__/mocks/handlers.ts',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'contexts/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/*.stories.{js,jsx,ts,tsx}',
    '!**/e2e/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
