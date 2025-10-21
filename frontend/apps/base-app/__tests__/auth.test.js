/**
 * Auth utility tests aligned with cookie-based authentication flow.
 */

// Capture original fetch to restore later
const originalFetch = global.fetch;

describe("auth utilities", () => {
  beforeAll(() => {
    // Mock fetch for all tests in this suite
    global.fetch = jest.fn();
  });

  beforeEach(() => {
    fetch.mockReset();
    // Mock environment for testing
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8000";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  });

  afterAll(() => {
    // Restore original fetch to avoid polluting other test suites
    global.fetch = originalFetch;
  });

  test("login sends credentials with cookie support", async () => {
    const mockJson = { success: true };
    const mockHeaders = new Map();
    mockHeaders.entries = jest.fn(() => [].entries());

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(mockJson),
      headers: mockHeaders,
      status: 200,
    };
    fetch.mockResolvedValue(mockResponse);

    const { login } = require("../lib/auth");

    const result = await login({ username: "admin", password: "admin123" });

    // Expect full URL with base URL from environment
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/login/cookie"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" }),
      }),
    );
    expect(mockResponse.json).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockJson);
  });

  test("login throws with API error detail", async () => {
    const mockHeaders = new Map();
    mockHeaders.entries = jest.fn(() => [].entries());

    const mockResponse = {
      ok: false,
      json: jest.fn().mockResolvedValue({ detail: "Invalid username or password" }),
      status: 401,
      headers: mockHeaders,
    };
    fetch.mockResolvedValue(mockResponse);

    const { login } = require("../lib/auth");

    await expect(login({ username: "bad-user", password: "nope" })).rejects.toThrow(
      "Invalid username or password",
    );
  });

  test("register posts form data and relies on cookies", async () => {
    const mockJson = {
      access_token: "token",
      refresh_token: "refresh",
      token_type: "bearer",
    };
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(mockJson),
    };
    fetch.mockResolvedValue(mockResponse);

    const { register } = require("../lib/auth");

    const result = await register({
      email: "admin@example.com",
      password: "admin123",
      name: "System Administrator",
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/register"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "admin",
          email: "admin@example.com",
          password: "admin123",
          full_name: "System Administrator",
        }),
      }),
    );
    expect(result).toEqual(mockJson);
  });

  test("getCurrentUser fetches with credentials include", async () => {
    const mockUser = {
      id: "1",
      email: "admin@example.com",
      full_name: "System Administrator",
    };
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(mockUser),
    };
    fetch.mockResolvedValue(mockResponse);

    const { getCurrentUser } = require("../lib/auth");

    const result = await getCurrentUser();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/auth/me"), {
      credentials: "include",
    });
    expect(result).toEqual(mockUser);
  });

  test("getCurrentUser throws on failure", async () => {
    const mockResponse = { ok: false, status: 401 };
    fetch.mockResolvedValue(mockResponse);

    const { getCurrentUser } = require("../lib/auth");

    await expect(getCurrentUser()).rejects.toThrow("Failed to fetch user");
  });

  test("logout posts to logout endpoint", async () => {
    const mockResponse = { ok: true };
    fetch.mockResolvedValue(mockResponse);

    const { logout } = require("../lib/auth");

    await logout();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
  });

  test("isAuthenticated returns true when verify succeeds", async () => {
    const mockResponse = { ok: true };
    fetch.mockResolvedValue(mockResponse);

    const { isAuthenticated } = require("../lib/auth");

    await expect(isAuthenticated()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/auth/verify"), {
      credentials: "include",
    });
  });

  test("isAuthenticated returns false when verify fails", async () => {
    const mockResponse = { ok: false };
    fetch.mockResolvedValue(mockResponse);

    const { isAuthenticated } = require("../lib/auth");

    await expect(isAuthenticated()).resolves.toBe(false);
  });

  test("saveTokens logs informational message", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { saveTokens } = require("../lib/auth");

    saveTokens({
      access_token: "token",
      refresh_token: "refresh",
      token_type: "bearer",
    });

    expect(logSpy).toHaveBeenCalled();
  });

  test("getAccessToken always returns null for HttpOnly cookies", () => {
    const { getAccessToken } = require("../lib/auth");

    expect(getAccessToken()).toBeNull();
  });

  test("clearTokens logs intention but performs no client action", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { clearTokens } = require("../lib/auth");

    clearTokens();

    expect(logSpy).toHaveBeenCalled();
  });
});
