/**
 * MSW Tests for useDomainVerification hook
 * Tests domain verification system with realistic API mocking
 */

// Mock platformConfig to provide a base URL for MSW to intercept
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import { useDomainVerification, useDomainStatus, useDomainValidation } from "../useDomainVerification";
import { clearDomainStatuses, seedDomainStatus } from "@/__tests__/msw/handlers/domain-verification";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useDomainVerification", () => {
  const tenantId = "tenant-123";

  beforeEach(() => {
    clearDomainStatuses();
  });


  describe("Mutation Hooks", () => {
    describe("initiate verification", () => {
      it("should initiate DNS TXT verification successfully", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.initiateAsync({ domain: "example.com", method: "dns_txt" });
        });

        await waitFor(() => expect(result.current.initiateResult?.status === "pending").toBe(true));

        expect(result.current.initiateResult?.domain).toBe("example.com");
        expect(result.current.initiateResult?.method).toBe("dns_txt");
        expect(result.current.initiateResult?.token).toBeDefined();
        expect(result.current.initiateResult?.expires_at).toBeDefined();
        expect(result.current.initiateResult?.instructions).toBeDefined();
        expect(result.current.initiateResult?.instructions?.type).toBe("DNS TXT Record");
      });

      it("should initiate DNS CNAME verification successfully", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.initiateAsync({ domain: "custom.example.com", method: "dns_cname" });
        });

        await waitFor(() => expect(result.current.initiateResult?.status === "pending").toBe(true));

        expect(result.current.initiateResult?.method).toBe("dns_cname");
        expect(result.current.initiateResult?.instructions?.type).toBe("DNS CNAME Record");
        expect(result.current.initiateResult?.instructions?.dns_record?.type).toBe("CNAME");
      });

      it("should initiate meta tag verification successfully", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.initiateAsync({ domain: "meta.example.com", method: "meta_tag" });
        });

        await waitFor(() => expect(result.current.initiateResult?.status === "pending").toBe(true));

        expect(result.current.initiateResult?.method).toBe("meta_tag");
        expect(result.current.initiateResult?.instructions?.type).toBe("HTML Meta Tag");
      });

      it("should initiate file upload verification successfully", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.initiateAsync({ domain: "file.example.com", method: "file_upload" });
        });

        await waitFor(() => expect(result.current.initiateResult?.status === "pending").toBe(true));

        expect(result.current.initiateResult?.method).toBe("file_upload");
        expect(result.current.initiateResult?.instructions?.type).toBe("File Upload");
      });

      it("should track isInitiating state during mutation", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.initiateAsync).toBeDefined();

        let mutation: Promise<unknown> | undefined;
        await act(async () => {
          mutation = result.current.initiateAsync({ domain: "example.com", method: "dns_txt" });
        });

        await mutation!;
        await waitFor(() => expect(result.current.isInitiating).toBe(false));
      });
    });

    describe("check verification", () => {
      it("should verify domain successfully with correct token", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        // Ensure mutations are available before invoking
        expect(result.current.initiateAsync).toBeDefined();

        // First initiate verification
        let initiateResult;
        await act(async () => {
          initiateResult = await result.current.initiateAsync({ domain: "example.com", method: "dns_txt" });
        });

        await waitFor(() => expect(result.current.initiateResult?.status === "pending").toBe(true));

        // Then check verification with the returned token
        await act(async () => {
          await result.current.checkAsync({
            domain: "example.com",
            token: initiateResult.token,
            method: "dns_txt",
          });
        });

        await waitFor(() => expect(result.current.checkResult?.status === "verified").toBe(true));

        expect(result.current.checkResult?.domain).toBe("example.com");
        expect(result.current.checkResult?.verified_at).toBeDefined();
      });

      it("should fail verification with incorrect token", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.initiateAsync).toBeDefined();

        // First initiate verification
        await act(async () => {
          await result.current.initiateAsync({ domain: "example.com", method: "dns_txt" });
        });

        await waitFor(() => expect(result.current.initiateResult?.status === "pending").toBe(true));

        // Then check with wrong token
        await act(async () => {
          await result.current.checkAsync({
            domain: "example.com",
            token: "wrong-token",
            method: "dns_txt",
          });
        });

        await waitFor(() => expect(result.current.checkResult?.status === "failed").toBe(true));

        expect(result.current.checkResult?.error_message).toBeDefined();
      });

      it("should track isChecking state during mutation", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.initiateAsync).toBeDefined();

        let mutation: Promise<unknown> | undefined;
        await act(async () => {
          mutation = result.current.checkAsync({
            domain: "example.com",
            token: "some-token",
            method: "dns_txt",
          });
        });

        await mutation!;
        await waitFor(() => expect(result.current.isChecking).toBe(false));
      });
    });

    describe("remove domain", () => {
      it("should remove domain successfully", async () => {
        seedDomainStatus(tenantId, {
          domain: "example.com",
          is_verified: true,
          verified_at: "2024-01-01T00:00:00Z",
        });

        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.initiateAsync).toBeDefined();

        await act(async () => {
          await result.current.removeAsync();
        });

        await waitFor(() => expect(result.current.removeResult?.status === "removed").toBe(true));

        expect(result.current.removeResult?.domain).toBe("example.com");
        expect(result.current.removeResult?.removed_at).toBeDefined();
      });

      it("should track isRemoving state during mutation", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.initiateAsync).toBeDefined();

        let mutation: Promise<unknown> | undefined;
        await act(async () => {
          mutation = result.current.removeAsync();
        });

        await mutation!;
        await waitFor(() => expect(result.current.isRemoving).toBe(false));
      });
    });

    describe("reset", () => {
      it("should reset all mutation states", async () => {
        const { result } = renderHook(() => useDomainVerification(tenantId), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.initiateAsync).toBeDefined();

        // Trigger a mutation
        await act(async () => {
          await result.current.initiateAsync({ domain: "example.com", method: "dns_txt" });
        });

        await waitFor(() => expect(result.current.initiateResult).toBeDefined());

        expect(result.current.initiateResult).toBeDefined();

        // Reset
        act(() => {
          result.current.reset();
        });

        // All errors should be cleared
        expect(result.current.initiateError).toBeNull();
        expect(result.current.checkError).toBeNull();
        expect(result.current.removeError).toBeNull();
      });
    });
  });

  describe("Cache Invalidation", () => {
    it("should invalidate domain status query after successful initiate", async () => {
      const wrapper = createQueryWrapper();

      const { result: verificationResult } = renderHook(() => useDomainVerification(tenantId), {
        wrapper,
      });

      const { result: statusResult } = renderHook(() => useDomainStatus(tenantId), {
        wrapper,
      });

      // Wait for hooks to be ready
      await waitFor(() => expect(verificationResult.current).not.toBeNull());
      await waitFor(() => expect(statusResult.current).not.toBeNull());

      // Wait for initial status fetch
      await waitFor(() => expect(statusResult.current.isSuccess).toBe(true));

      // Initiate verification
      await act(async () => {
        await verificationResult.current.initiateAsync({ domain: "example.com", method: "dns_txt" });
      });

      await waitFor(() => expect(verificationResult.current.initiateResult).toBeDefined());

      // Manual refetch due to test QueryClient config disabling auto refetch
      await act(async () => {
        await statusResult.current.refetch();
      });
      const refreshed = await statusResult.current.refetch();
      expect(refreshed.data?.domain).toBe("example.com");
    });

    it("should invalidate domain status query after successful check", async () => {
      const wrapper = createQueryWrapper();

      const { result: verificationResult } = renderHook(() => useDomainVerification(tenantId), {
        wrapper,
      });

      const { result: statusResult } = renderHook(() => useDomainStatus(tenantId), {
        wrapper,
      });

      // Wait for hooks to be ready
      await waitFor(() => expect(verificationResult.current).not.toBeNull());
      await waitFor(() => expect(statusResult.current).not.toBeNull());

      // Initiate first
      let initiateResult;
      await act(async () => {
        initiateResult = await verificationResult.current.initiateAsync({ domain: "example.com", method: "dns_txt" });
      });

      await waitFor(() => expect(verificationResult.current.initiateResult).toBeDefined());

      // Check verification
      await act(async () => {
        await verificationResult.current.checkAsync({
          domain: "example.com",
          token: initiateResult.token,
          method: "dns_txt",
        });
      });

      await waitFor(() => expect(verificationResult.current.checkResult?.status === "verified").toBe(true));

      await act(async () => {
        await statusResult.current.refetch();
      });
      const verifiedStatus = await statusResult.current.refetch();
      expect(verifiedStatus.data?.is_verified).toBe(true);
    });

    it("should invalidate domain status query after successful remove", async () => {
      seedDomainStatus(tenantId, {
        domain: "example.com",
        is_verified: true,
      });

      const wrapper = createQueryWrapper();

      const { result: verificationResult } = renderHook(() => useDomainVerification(tenantId), {
        wrapper,
      });

      const { result: statusResult } = renderHook(() => useDomainStatus(tenantId), {
        wrapper,
      });

      // Wait for hooks to be ready
      await waitFor(() => expect(verificationResult.current).not.toBeNull());
      await waitFor(() => expect(statusResult.current).not.toBeNull());

      // Wait for initial status
      await waitFor(() => expect(statusResult.current.data?.is_verified).toBe(true));

      // Remove domain
      await act(async () => {
        await verificationResult.current.removeAsync();
      });

      await waitFor(() => expect(verificationResult.current.removeResult).toBeDefined());

      await act(async () => {
        await statusResult.current.refetch();
      });
      const removedStatus = await statusResult.current.refetch();
      expect(removedStatus.data?.domain).toBeNull();
    });
  });
});

describe("useDomainStatus", () => {
  const tenantId = "tenant-123";

  beforeEach(() => {
    clearDomainStatuses();
  });

  afterEach(() => {
    // No-op
  });

  describe("Query Hook", () => {
    it("should fetch domain status successfully", async () => {
      seedDomainStatus(tenantId, {
        domain: "example.com",
        is_verified: true,
        verified_at: "2024-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useDomainStatus(tenantId), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.is_verified).toBe(true);
      expect(result.current.data?.domain).toBe("example.com");
      expect(result.current.data?.verified_at).toBe("2024-01-01T00:00:00Z");
    });

    it("should return no domain when none exists", async () => {
      const { result } = renderHook(() => useDomainStatus(tenantId), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.is_verified).toBe(false);
      expect(result.current.data?.domain).toBeNull();
    });

    it("should not fetch when tenantId is undefined", () => {
      const { result } = renderHook(() => useDomainStatus(undefined), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle pending verification status", async () => {
      seedDomainStatus(tenantId, {
        domain: "pending.example.com",
        is_verified: false,
        status: "pending",
        method: "dns_txt",
        token: "test-token-123",
      });

      const { result } = renderHook(() => useDomainStatus(tenantId), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.domain).toBe("pending.example.com");
      expect(result.current.data?.is_verified).toBe(false);
      expect(result.current.data?.status).toBe("pending");
    });
  });
});

describe("useDomainValidation", () => {
  it("should expose validateDomain function", async () => {
    const { result } = renderHook(() => useDomainValidation(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current.validateDomain).toBeDefined();
    expect(typeof result.current.validateDomain).toBe("function");
  });

  it("should validate domain correctly", async () => {
    const { result } = renderHook(() => useDomainValidation(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current).not.toBeNull());

    // Valid domain
    expect(result.current.validateDomain("example.com").valid).toBe(true);
    expect(result.current.validateDomain("subdomain.example.com").valid).toBe(true);
    expect(result.current.validateDomain("multi.level.subdomain.example.com").valid).toBe(true);

    // Invalid domains
    expect(result.current.validateDomain("").valid).toBe(false);
    expect(result.current.validateDomain("   ").valid).toBe(false);
    expect(result.current.validateDomain("invalid domain.com").valid).toBe(false);
    expect(result.current.validateDomain("ab").valid).toBe(false);
  });
});

describe("Real-world scenarios", () => {
  const tenantId = "tenant-real-world";

  beforeEach(() => {
    clearDomainStatuses();
  });


  it("should handle verification failure and retry", async () => {
    const { result } = renderHook(() => useDomainVerification(tenantId), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.initiateAsync).toBeDefined();

    // Initiate verification
    let initiateResult;
    await act(async () => {
      initiateResult = await result.current.initiateAsync({
        domain: "retry.example.com",
        method: "dns_txt",
      });
    });

    await waitFor(() => expect(result.current.initiateResult).toBeDefined());

    // First attempt with wrong token (fails)
    await act(async () => {
      await result.current.checkAsync({
        domain: "retry.example.com",
        token: "wrong-token",
        method: "dns_txt",
      });
    });

    await waitFor(() => expect(result.current.checkResult?.status === "failed").toBe(true));
    expect(result.current.checkResult?.error_message).toBeDefined();

    // Second attempt with correct token (succeeds)
    await act(async () => {
      await result.current.checkAsync({
        domain: "retry.example.com",
        token: initiateResult.token,
        method: "dns_txt",
      });
    });

    await waitFor(() => expect(result.current.checkResult?.status === "verified").toBe(true));
  });

  it("should handle all verification methods", async () => {
    const methods: Array<"dns_txt" | "dns_cname" | "meta_tag" | "file_upload"> = [
      "dns_txt",
      "dns_cname",
      "meta_tag",
      "file_upload",
    ];

    for (const method of methods) {
      clearDomainStatuses();

      const { result } = renderHook(() => useDomainVerification(tenantId), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current).not.toBeNull());
      expect(result.current?.initiateAsync).toBeDefined();

      // Initiate with each method
      let initiateResult;
      await act(async () => {
        initiateResult = await result.current.initiateAsync({
          domain: `${method}.example.com`,
          method,
        });
      });

      await waitFor(() => expect(result.current.initiateResult).toBeDefined());

      expect(initiateResult.method).toBe(method);
      expect(initiateResult.instructions).toBeDefined();

      // Verify with each method
      await act(async () => {
        await result.current.checkAsync({
          domain: `${method}.example.com`,
          token: initiateResult.token,
          method,
        });
      });

      await waitFor(() => expect(result.current.checkResult?.status === "verified").toBe(true));
    }
  });
});
// Ensure components are unmounted between tests to prevent cross-test pollution
afterEach(() => {
  cleanup();
});
