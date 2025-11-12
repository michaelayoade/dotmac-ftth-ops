/**
 * Tests for useDomainVerification hooks
 * Tests domain verification operations
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDomainVerification, useDomainStatus, useDomainValidation } from "../useDomainVerification";
import { domainVerificationService } from "@/lib/services/domain-verification-service";

// Mock the service
jest.mock("@/lib/services/domain-verification-service", () => ({
  domainVerificationService: {
    initiateVerification: jest.fn(),
    checkVerification: jest.fn(),
    removeDomain: jest.fn(),
    getStatus: jest.fn(),
    validateDomain: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useDomainVerification", () => {
  const tenantId = "tenant-123";

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initiate verification", () => {
    it("should initiate verification successfully", async () => {
      const mockResponse = {
        status: "pending",
        verification_token: "token-123",
        dns_records: [],
      };

      (domainVerificationService.initiateVerification as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.initiate({ domain: "example.com" });
      });

      await waitFor(() => expect(result.current.isInitiating).toBe(false));

      expect(result.current.initiateResult).toEqual(mockResponse);
      expect(domainVerificationService.initiateVerification).toHaveBeenCalledWith(
        tenantId,
        { domain: "example.com" }
      );
    });

    it("should handle initiate error", async () => {
      const mockError = new Error("Domain already exists");
      (domainVerificationService.initiateVerification as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.initiate({ domain: "example.com" });
      });

      await waitFor(() => expect(result.current.isInitiating).toBe(false));

      expect(result.current.initiateError).toEqual(mockError);
    });

    it("should expose initiateAsync for async operations", async () => {
      const mockResponse = { status: "pending" };
      (domainVerificationService.initiateVerification as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      let asyncResult;
      await act(async () => {
        asyncResult = await result.current.initiateAsync({ domain: "example.com" });
      });

      expect(asyncResult).toEqual(mockResponse);
    });
  });

  describe("check verification", () => {
    it("should check verification successfully", async () => {
      const mockResponse = {
        status: "verified",
        domain: "example.com",
      };

      (domainVerificationService.checkVerification as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.check({ domain: "example.com" });
      });

      await waitFor(() => expect(result.current.isChecking).toBe(false));

      expect(result.current.checkResult).toEqual(mockResponse);
    });

    it("should handle check error", async () => {
      const mockError = new Error("Verification failed");
      (domainVerificationService.checkVerification as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.check({ domain: "example.com" });
      });

      await waitFor(() => expect(result.current.isChecking).toBe(false));

      expect(result.current.checkError).toEqual(mockError);
    });

    it("should expose checkAsync for async operations", async () => {
      const mockResponse = { status: "verified" };
      (domainVerificationService.checkVerification as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      let asyncResult;
      await act(async () => {
        asyncResult = await result.current.checkAsync({ domain: "example.com" });
      });

      expect(asyncResult).toEqual(mockResponse);
    });
  });

  describe("remove domain", () => {
    it("should remove domain successfully", async () => {
      const mockResponse = {
        success: true,
        message: "Domain removed",
      };

      (domainVerificationService.removeDomain as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.remove();
      });

      await waitFor(() => expect(result.current.isRemoving).toBe(false));

      expect(result.current.removeResult).toEqual(mockResponse);
    });

    it("should handle remove error", async () => {
      const mockError = new Error("Failed to remove domain");
      (domainVerificationService.removeDomain as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.remove();
      });

      await waitFor(() => expect(result.current.isRemoving).toBe(false));

      expect(result.current.removeError).toEqual(mockError);
    });
  });

  describe("reset", () => {
    it("should reset all mutations", async () => {
      (domainVerificationService.initiateVerification as jest.Mock).mockResolvedValue({
        status: "pending",
      });

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.initiate({ domain: "example.com" });
      });

      await waitFor(() => expect(result.current.isInitiating).toBe(false));
      expect(result.current.initiateResult).toBeDefined();

      await act(async () => {
        result.current.reset();
      });

      await waitFor(() => {
        // All mutations should be reset
        expect(result.current.initiateResult).toBeUndefined();
        expect(result.current.checkResult).toBeUndefined();
        expect(result.current.removeResult).toBeUndefined();
      });
    });
  });
});

describe("useDomainStatus", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch domain status", async () => {
    const mockStatus = {
      status: "verified",
      domain: "example.com",
      verified_at: "2024-01-01T00:00:00Z",
    };

    (domainVerificationService.getStatus as jest.Mock).mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useDomainStatus("tenant-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStatus);
    expect(domainVerificationService.getStatus).toHaveBeenCalledWith("tenant-123");
  });

  it("should not fetch when tenantId is undefined", () => {
    const { result } = renderHook(() => useDomainStatus(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(domainVerificationService.getStatus).not.toHaveBeenCalled();
  });

  it("should handle fetch error", async () => {
    const mockError = new Error("Failed to fetch status");
    (domainVerificationService.getStatus as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useDomainStatus("tenant-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});

describe("useDomainValidation", () => {
  it("should provide validateDomain function", () => {
    const { result } = renderHook(() => useDomainValidation());

    expect(result.current.validateDomain).toBe(domainVerificationService.validateDomain);
  });

  it("should call service validateDomain", () => {
    const mockIsValid = true;
    (domainVerificationService.validateDomain as jest.Mock).mockReturnValue(mockIsValid);

    const { result } = renderHook(() => useDomainValidation());

    const isValid = result.current.validateDomain("example.com");

    expect(isValid).toBe(mockIsValid);
    expect(domainVerificationService.validateDomain).toHaveBeenCalledWith("example.com");
  });
});
