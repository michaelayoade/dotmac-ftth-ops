let accessToken = null;

const getOperatorAccessToken = jest.fn(() => accessToken);
const setOperatorAccessToken = jest.fn((token) => {
  accessToken = token ?? null;
});
const clearOperatorAuthTokens = jest.fn(() => {
  accessToken = null;
});

module.exports = {
  getOperatorAccessToken,
  setOperatorAccessToken,
  clearOperatorAuthTokens,
};
