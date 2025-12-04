/**
 * Setup file that runs before the test environment is ready.
 * We register module mocks here so they're in place before any test modules load.
 */

// Provide globals Jest can attach mocks to
global.mockToast = jest.fn();
global.mockDismiss = jest.fn();

const createUiMock = () => {
  const actual = jest.requireActual("@dotmac/ui");

  return {
    ...actual,
    useToast: () => ({
      toast: global.mockToast,
      dismiss: global.mockDismiss,
      toasts: [],
    }),
  };
};

// Ensure mocked useToast is used regardless of how the module is resolved
jest.mock("@dotmac/ui", () => createUiMock());
jest.mock("../../shared/packages/ui/src", () => createUiMock());
