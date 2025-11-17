module.exports = {
  until: async (callback) => {
    try {
      const result = await callback();
      return [null, result];
    } catch (error) {
      return [error, null];
    }
  },
};
