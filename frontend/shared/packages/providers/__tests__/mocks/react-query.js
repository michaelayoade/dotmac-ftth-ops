/**
 * Mock for @tanstack/react-query in provider tests
 */

const QueryClient = jest.fn().mockImplementation(() => ({
  setDefaultOptions: jest.fn(),
  getQueryData: jest.fn(),
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
  clear: jest.fn(),
}));

const QueryClientProvider = ({ children }) => children;

const useQueryClient = jest.fn(() => ({
  getQueryData: jest.fn(),
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
}));

const useQuery = jest.fn(() => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn(),
}));

const useMutation = jest.fn(() => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  isLoading: false,
  error: null,
}));

module.exports = {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
  useQuery,
  useMutation,
};
