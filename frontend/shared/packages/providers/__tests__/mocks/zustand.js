/**
 * Mock for zustand in provider tests
 */

const create = jest.fn((fn) => fn);
const subscribeWithSelector = jest.fn((fn) => fn);

module.exports = {
  create,
  subscribeWithSelector,
};
