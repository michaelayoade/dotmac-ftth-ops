const { createRequire } = require('module');

const requireFromMsw = createRequire(require.resolve('msw/package.json'));

module.exports = requireFromMsw('./node');
