import { impersonateCustomer } from "../../../../shared/utils/customerImpersonation";
import {
  setPortalAuthToken,
  CUSTOMER_PORTAL_TOKEN_KEY,
} from "../../../../shared/utils/operatorAuth";

jest.mock("../../../../shared/utils/operatorAuth", () => {
  const actual = jest.requireActual("../../../../shared/utils/operatorAuth");
  return {
    ...actual,
    setPortalAuthToken: jest.fn(),
    CUSTOMER_PORTAL_TOKEN_KEY: actual.CUSTOMER_PORTAL_TOKEN_KEY,
  };
});

const mockSetPortalAuthToken = setPortalAuthToken as jest.MockedFunction<typeof setPortalAuthToken>;

describe("customer impersonation helper", () => {
  const baseUrl = "https://api.example.com";
  const buildHeaders = () => ({ Authorization: "Bearer token" });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("persists the token when impersonation succeeds", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "token-isp" }),
    });

    await expect(
      impersonateCustomer({
        customerId: "cust-123",
        baseUrl,
        buildHeaders,
        fetchImpl,
      }),
    ).resolves.toBe("token-isp");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/customers/cust-123/impersonate",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(mockSetPortalAuthToken).toHaveBeenCalledWith("token-isp", CUSTOMER_PORTAL_TOKEN_KEY);
  });

  it("throws when the API responds with an error", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(
      impersonateCustomer({
        customerId: "cust-123",
        baseUrl,
        buildHeaders,
        fetchImpl,
      }),
    ).rejects.toThrow("Failed to generate impersonation token");

    expect(mockSetPortalAuthToken).not.toHaveBeenCalled();
  });

  it("throws when the token is missing", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(
      impersonateCustomer({
        customerId: "cust-123",
        baseUrl,
        buildHeaders,
        fetchImpl,
      }),
    ).rejects.toThrow("Received empty impersonation token");

    expect(mockSetPortalAuthToken).not.toHaveBeenCalled();
  });
});
