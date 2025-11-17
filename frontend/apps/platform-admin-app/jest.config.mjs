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
    '^@dotmac/headless/utils$': '<rootDir>/__mocks__/headless-utils.js',
    '^react$': reactPath,
    '^react-dom$': reactDomPath,
    '^@tanstack/react-query$': '<rootDir>/node_modules/@tanstack/react-query',
    '^msw/node$': '<rootDir>/jest.mswnode.cjs',
    '^@mswjs/interceptors$': '<rootDir>/jest.msw.interceptors.cjs',
    '^@mswjs/interceptors/ClientRequest$': '<rootDir>/jest.msw.interceptors.client.cjs',
    '^@mswjs/interceptors/XMLHttpRequest$': '<rootDir>/jest.msw.interceptors.xhr.cjs',
    '^@mswjs/interceptors/fetch$': '<rootDir>/jest.msw.interceptors.fetch.cjs',
    '^until-async$': '<rootDir>/jest.until-async.cjs',
    '^until-async/(.*)$': '<rootDir>/jest.until-async.cjs',
  },
  transformIgnorePatterns: ['node_modules/(?!(msw)/)'],
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
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
