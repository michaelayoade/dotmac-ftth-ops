const { resolveInterceptorsSubpath } = require('./jest.msw.resolve-interceptors.cjs');

module.exports = require(
  resolveInterceptorsSubpath('lib/node/interceptors/ClientRequest/index.js'),
);
