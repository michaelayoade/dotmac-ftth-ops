const { createRequire } = require('module');
const { TextEncoder, TextDecoder } = require('util');
const { ReadableStream, WritableStream, TransformStream } = require('stream/web');

// Polyfill TextEncoder/TextDecoder before loading MSW
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}
if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}
if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
}
if (!global.WritableStream) {
  global.WritableStream = WritableStream;
}
if (!global.TransformStream) {
  global.TransformStream = TransformStream;
}

const requireFromMsw = createRequire(require.resolve('msw/package.json'));

module.exports = requireFromMsw('./node');
