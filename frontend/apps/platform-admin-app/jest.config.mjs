import nextJest from 'next/jest.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const reactPath = require.resolve('react');
const reactDomPath = require.resolve('react-dom');

const createJestConfig = nextJest({
  dir: './',
});

const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/jest.setup.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@dotmac/testing$': '<rootDir>/../../shared/packages/primitives/src/testing/index.ts',
    '^@dotmac/better-auth$': '<rootDir>/../../shared/lib/better-auth',
    '^@dotmac/better-auth/(.*)$': '<rootDir>/../../shared/lib/better-auth/$1',
    '^@dotmac/(?!better-auth)([^/]+)$': '<rootDir>/../../shared/packages/$1/src',
    '^@dotmac/(?!better-auth)([^/]+)/(.+)$': '<rootDir>/../../shared/packages/$1/src/$2',
    '^react$': reactPath,
    '^react-dom$': reactDomPath,
    '^@tanstack/react-query$': '<rootDir>/node_modules/@tanstack/react-query',
  },
  transformIgnorePatterns: ['node_modules/'],
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', 'test-utils.tsx'],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/*.stories.{js,jsx,ts,tsx}',
    '!**/e2e/**',
  ],
};

export default createJestConfig(config);
