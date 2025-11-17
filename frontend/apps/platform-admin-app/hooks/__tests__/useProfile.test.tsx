/**
 * Tests for useProfile hooks
 * Tests profile management, password change, 2FA, avatar upload, and session management
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useUpdateProfile,
  useChangePassword,
  useVerifyPhone,
  useEnable2FA,
  useVerify2FA,
  useDisable2FA,
  useUploadAvatar,
  useDeleteAccount,
  useExportData,
  useListSessions,
  useRevokeSession,
  useRevokeAllSessions,
} from "../useProfile";
import { authService } from "@/lib/api/services/auth.service";
import apiClient from "@/lib/api/client";
import { logger } from "@/lib/logger";

// Mock authService
jest.mock("@/lib/api/services/auth.service", () => ({
  authService: {
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
  },
}));

// Mock apiClient
jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
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


describe("useProfile", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("useUpdateProfile", () => {
    it("should update profile successfully", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
      };

      (authService.updateProfile as jest.Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          first_name: "John",
          last_name: "Doe",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUser);
      expect(authService.updateProfile).toHaveBeenCalledWith({
        first_name: "John",
        last_name: "Doe",
      });
      expect(logger.info).toHaveBeenCalledWith("Profile updated successfully", {
        userId: mockUser.id,
      });
    });

    it("should handle update error", async () => {
      const mockError = new Error("Update failed");
      (authService.updateProfile as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ first_name: "John" });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to update profile", mockError);
    });

    it("should log fields being updated", async () => {
      (authService.updateProfile as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          first_name: "John",
          email: "john@example.com",
          timezone: "UTC",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(logger.info).toHaveBeenCalledWith("Updating profile", {
        fields: ["first_name", "email", "timezone"],
      });
    });
  });

  describe("useChangePassword", () => {
    it("should change password successfully", async () => {
      const mockResponse = { message: "Password changed successfully" };
      (apiClient.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const { result } = renderHook(() => useChangePassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          current_password: "oldpass",
          new_password: "newpass",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/change-password", {
        current_password: "oldpass",
        new_password: "newpass",
      });
      expect(logger.info).toHaveBeenCalledWith("Password changed successfully");
    });

    it("should handle change password error", async () => {
      const mockError = new Error("Invalid current password");
      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useChangePassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          current_password: "wrong",
          new_password: "newpass",
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to change password", mockError);
    });

    it("should handle non-200 status code", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        status: 400,
        data: {},
      });

      const { result } = renderHook(() => useChangePassword(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          current_password: "old",
          new_password: "new",
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect((result.current.error as Error).message).toBe("Failed to change password");
    });
  });

  describe("useVerifyPhone", () => {
    it("should verify phone successfully", async () => {
      const mockResponse = { message: "Phone verified" };
      (apiClient.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const { result } = renderHook(() => useVerifyPhone(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("+1234567890");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/verify-phone", {
        phone: "+1234567890",
      });
      expect(logger.info).toHaveBeenCalledWith("Phone verified successfully");
    });

    it("should handle verify phone error", async () => {
      const mockError = new Error("Invalid phone number");
      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useVerifyPhone(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("+1234567890");
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useEnable2FA", () => {
    it("should enable 2FA successfully", async () => {
      const mockResponse = {
        secret: "JBSWY3DPEHPK3PXP",
        qr_code: "data:image/png;base64,abc",
        backup_codes: ["code1", "code2"],
        provisioning_uri: "otpauth://totp/...",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const { result } = renderHook(() => useEnable2FA(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ password: "password123" });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/2fa/enable", {
        password: "password123",
      });
      expect(logger.info).toHaveBeenCalledWith("2FA setup initiated successfully");
    });

    it("should handle enable 2FA error", async () => {
      const mockError = new Error("Invalid password");
      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useEnable2FA(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ password: "wrong" });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to enable 2FA", mockError);
    });
  });

  describe("useVerify2FA", () => {
    it("should verify 2FA token successfully", async () => {
      const mockResponse = {
        message: "2FA enabled",
        mfa_enabled: true,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const { result } = renderHook(() => useVerify2FA(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ token: "123456" });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/2fa/verify", {
        token: "123456",
      });
      expect(logger.info).toHaveBeenCalledWith("2FA enabled successfully");
    });

    it("should handle verify 2FA error", async () => {
      const mockError = new Error("Invalid token");
      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useVerify2FA(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ token: "000000" });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to verify 2FA", mockError);
    });
  });

  describe("useDisable2FA", () => {
    it("should disable 2FA successfully", async () => {
      const mockResponse = {
        message: "2FA disabled",
        mfa_enabled: false,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const { result } = renderHook(() => useDisable2FA(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          password: "password123",
          token: "123456",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/auth/2fa/disable", {
        password: "password123",
        token: "123456",
      });
      expect(logger.info).toHaveBeenCalledWith("2FA disabled successfully");
    });

    it("should handle disable 2FA error", async () => {
      const mockError = new Error("Invalid password or token");
      (apiClient.post as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDisable2FA(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          password: "wrong",
          token: "000000",
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useUploadAvatar", () => {
    it("should upload avatar successfully", async () => {
      const mockFile = new File(["avatar"], "avatar.png", { type: "image/png" });
      const mockData = { avatar_url: "/uploads/avatar.png" };

      (authService.uploadAvatar as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() => useUploadAvatar(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(mockFile);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(authService.uploadAvatar).toHaveBeenCalledWith(mockFile);
      expect(logger.info).toHaveBeenCalledWith("Avatar uploaded successfully");
    });

    it("should log file details", async () => {
      const mockFile = new File(["avatar"], "avatar.png", { type: "image/png" });
      (authService.uploadAvatar as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useUploadAvatar(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(mockFile);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(logger.info).toHaveBeenCalledWith("Uploading avatar", {
        fileName: "avatar.png",
        size: mockFile.size,
      });
    });

    it("should handle upload error", async () => {
      const mockFile = new File(["avatar"], "avatar.png", { type: "image/png" });
      const mockError = new Error("File too large");
      (authService.uploadAvatar as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUploadAvatar(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(mockFile);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to upload avatar", mockError);
    });
  });

  describe("useDeleteAccount", () => {
    let originalLocation: Location;

    beforeAll(() => {
      originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { href: "" };
    });

    afterAll(() => {
      (window as any).location = originalLocation;
    });

    it("should delete account successfully", async () => {
      const mockResponse = { message: "Account deleted" };
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          confirmation: "DELETE",
          password: "password123",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.delete).toHaveBeenCalledWith("/auth/me", {
        headers: { "X-Password": "password123" },
      });
      expect(logger.warn).toHaveBeenCalledWith("Deleting account");
      expect(logger.info).toHaveBeenCalledWith("Account deleted successfully");
      expect(window.location.href).toBe("/login?deleted=true");
    });

    it("should reject if confirmation is not DELETE", async () => {
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          confirmation: "delete",
          password: "password123",
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect((result.current.error as Error).message).toBe("Please type DELETE to confirm");
      expect(apiClient.delete).not.toHaveBeenCalled();
    });

    it("should handle delete error", async () => {
      const mockError = new Error("Invalid password");
      (apiClient.delete as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          confirmation: "DELETE",
          password: "wrong",
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to delete account", mockError);
    });
  });

  describe("useExportData", () => {
    let mockLink: any;
    let createElementSpy: jest.SpyInstance;
    let createObjectURLSpy: jest.SpyInstance;
    let revokeObjectURLSpy: jest.SpyInstance;
    let appendChildSpy: jest.SpyInstance;
    let removeChildSpy: jest.SpyInstance;

    beforeEach(() => {
      if (typeof URL.createObjectURL !== "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (URL as any).createObjectURL = () => "";
      }
      if (typeof URL.revokeObjectURL !== "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (URL as any).revokeObjectURL = () => {};
      }

      mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      };

      // Mock createElement to only intercept 'a' elements, use real implementation for others
      const realCreateElement = document.createElement.bind(document);
      createElementSpy = jest.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: any) => {
        if (tagName === "a") {
          return mockLink as any;
        }
        // Call real createElement for all other elements
        return realCreateElement(tagName, options);
      }) as any);

      const realAppendChild = document.body.appendChild.bind(document.body);
      const realRemoveChild = document.body.removeChild.bind(document.body);
      appendChildSpy = jest
        .spyOn(document.body, "appendChild")
        .mockImplementation(((node: any) => {
          if (node === mockLink) {
            return mockLink as any;
          }
          return realAppendChild(node);
        }) as any);
      removeChildSpy = jest
        .spyOn(document.body, "removeChild")
        .mockImplementation(((node: any) => {
          if (node === mockLink) {
            return mockLink as any;
          }
          return realRemoveChild(node);
        }) as any);

      // Mock URL.createObjectURL and URL.revokeObjectURL
      createObjectURLSpy = jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:url");
      revokeObjectURLSpy = jest.spyOn(URL, "revokeObjectURL").mockImplementation();
    });

    afterEach(() => {
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it("should export user data successfully", async () => {
      const mockData = {
        user: { id: "user-123", email: "test@example.com" },
        profile: { first_name: "John", last_name: "Doe" },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockData,
      });

      const { result } = renderHook(() => useExportData(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(apiClient.get).toHaveBeenCalledWith("/auth/me/export");
      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(mockLink.click).toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith("Profile data exported successfully");
    });

    it("should create correct filename with current date", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        status: 200,
        data: {},
      });

      const { result } = renderHook(() => useExportData(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockLink.download).toMatch(/^profile-data-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it("should handle export error", async () => {
      const mockError = new Error("Export failed");
      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useExportData(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to export data", mockError);
    });
  });

  describe("useListSessions", () => {
    it("should list sessions successfully", async () => {
      const mockSessions = {
        sessions: [
          {
            session_id: "session-1",
            created_at: "2024-01-01T00:00:00Z",
            ip_address: "192.168.1.1",
            user_agent: "Mozilla/5.0",
          },
        ],
        total: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockSessions,
      });

      const { result } = renderHook(() => useListSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockSessions);
      expect(apiClient.get).toHaveBeenCalledWith("/auth/me/sessions");
    });

    it("should handle list sessions error", async () => {
      const mockError = new Error("Failed to fetch sessions");
      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useListSessions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it("should have correct refetch interval", () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        status: 200,
        data: { sessions: [], total: 0 },
      });

      const { result } = renderHook(() => useListSessions(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
    });
  });

  describe("useRevokeSession", () => {
    it("should revoke session successfully", async () => {
      const mockResponse = { message: "Session revoked" };
      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const { result } = renderHook(() => useRevokeSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("session-123");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.delete).toHaveBeenCalledWith("/auth/me/sessions/session-123");
      expect(logger.info).toHaveBeenCalledWith("Session revoked successfully");
    });

    it("should handle revoke session error", async () => {
      const mockError = new Error("Session not found");
      (apiClient.delete as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useRevokeSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("session-123");
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to revoke session", mockError);
    });
  });

  describe("useRevokeAllSessions", () => {
    it("should revoke all sessions successfully", async () => {
      const mockResponse = {
        message: "All sessions revoked",
        sessions_revoked: 3,
      };

      (apiClient.delete as jest.Mock).mockResolvedValue({
        status: 200,
        data: mockResponse,
      });

      const { result } = renderHook(() => useRevokeAllSessions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.delete).toHaveBeenCalledWith("/auth/me/sessions");
      expect(logger.info).toHaveBeenCalledWith("All sessions revoked successfully");
    });

    it("should handle revoke all sessions error", async () => {
      const mockError = new Error("Failed to revoke sessions");
      (apiClient.delete as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useRevokeAllSessions(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalledWith("Failed to revoke all sessions", mockError);
    });
  });
});
