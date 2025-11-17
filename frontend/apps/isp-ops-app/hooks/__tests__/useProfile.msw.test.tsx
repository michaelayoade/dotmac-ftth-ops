/**
 * MSW Tests for useProfile hook
 * Tests profile management, 2FA, sessions, and account operations with realistic API mocking
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
import {
  clearProfileData,
  seedProfileData,
  seedSessions,
  seed2FAEnabled,
  createMockSession,
  createMockUserData,
} from "@/__tests__/msw/handlers/profile";
import { authService } from "@/lib/api/services/auth.service";

// Mock authService
jest.mock("@/lib/api/services/auth.service", () => ({
  authService: {
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
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

// Mock window.location for account deletion
const mockLocationHref = jest.fn();
Object.defineProperty(window, "location", {
  value: {
    href: "",
    get href() {
      return this._href;
    },
    set href(value) {
      mockLocationHref(value);
      this._href = value;
    },
  },
  writable: true,
});

// Mock DOM APIs for data export
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockClick = jest.fn();
const mockCreateObjectURL = jest.fn(() => "blob:mock-url");
const mockRevokeObjectURL = jest.fn();

// Keep original createElement but override specific behaviors
const originalCreateElement = document.createElement.bind(document);
document.createElement = jest.fn((tagName: string, options?: any) => {
  const element = originalCreateElement(tagName, options);
  if (tagName === "a") {
    element.click = mockClick;
  }
  return element;
}) as any;

const originalAppendChild = document.body.appendChild.bind(document.body);
document.body.appendChild = jest.fn((node: any) => {
  mockAppendChild(node);
  return node;
}) as any;

const originalRemoveChild = document.body.removeChild.bind(document.body);
document.body.removeChild = jest.fn((node: any) => {
  mockRemoveChild(node);
  return node;
}) as any;

URL.createObjectURL = mockCreateObjectURL as any;
URL.revokeObjectURL = mockRevokeObjectURL as any;

describe("useProfile", () => {
  beforeEach(() => {
    clearProfileData();
    jest.clearAllMocks();
    mockLocationHref.mockClear();
    mockAppendChild.mockClear();
    mockRemoveChild.mockClear();
    mockClick.mockClear();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("useUpdateProfile", () => {
    it("should update profile successfully", async () => {
      const mockUser = createMockUserData();
      (authService.updateProfile as jest.Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          first_name: "Updated",
          last_name: "Name",
        });
      });

      expect(authService.updateProfile).toHaveBeenCalledWith({
        first_name: "Updated",
        last_name: "Name",
      });
    });

    it("should handle update profile error", async () => {
      (authService.updateProfile as jest.Mock).mockRejectedValue(
        new Error("Update failed")
      );

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ first_name: "Fail" });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("should invalidate auth query on success", async () => {
      const mockUser = createMockUserData();
      (authService.updateProfile as jest.Mock).mockResolvedValue(mockUser);

      const queryWrapper = createQueryWrapper();
      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: queryWrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({ first_name: "Test" });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useChangePassword", () => {
    it("should change password successfully", async () => {
      const { result } = renderHook(() => useChangePassword(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          current_password: "oldpass123",
          new_password: "newpass456",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ message: "Password changed successfully" });
    });

    it("should handle missing password fields", async () => {
      const { result } = renderHook(() => useChangePassword(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            current_password: "",
            new_password: "newpass",
          });
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useVerifyPhone", () => {
    it("should verify phone number successfully", async () => {
      const { result } = renderHook(() => useVerifyPhone(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("+1234567890");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({
        message: "Phone verification initiated",
        verification_id: "verify-123",
      });
    });

    it("should handle missing phone number", async () => {
      const { result } = renderHook(() => useVerifyPhone(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("");
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("2FA Flow", () => {
    describe("useEnable2FA", () => {
      it("should enable 2FA and return QR code and backup codes", async () => {
        const { result } = renderHook(() => useEnable2FA(), {
          wrapper: createQueryWrapper(),
        });

        let response;
        await act(async () => {
          response = await result.current.mutateAsync({ password: "password123" });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(response).toHaveProperty("secret");
        expect(response).toHaveProperty("qr_code");
        expect(response).toHaveProperty("backup_codes");
        expect(response).toHaveProperty("provisioning_uri");
        expect(response.backup_codes).toHaveLength(5);
      });

      it("should handle missing password for 2FA enable", async () => {
        const { result } = renderHook(() => useEnable2FA(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ password: "" });
          } catch (error) {
            expect(error).toBeDefined();
          }
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
      });
    });

    describe("useVerify2FA", () => {
      it("should verify 2FA token successfully", async () => {
        const { result } = renderHook(() => useVerify2FA(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({ token: "123456" });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({
          message: "2FA enabled successfully",
          mfa_enabled: true,
        });
      });

      it("should handle missing token", async () => {
        const { result } = renderHook(() => useVerify2FA(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({ token: "" });
          } catch (error) {
            expect(error).toBeDefined();
          }
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
      });
    });

    describe("useDisable2FA", () => {
      it("should disable 2FA successfully", async () => {
        seed2FAEnabled(true);

        const { result } = renderHook(() => useDisable2FA(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            password: "password123",
            token: "123456",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({
          message: "2FA disabled successfully",
          mfa_enabled: false,
        });
      });

      it("should handle missing credentials for 2FA disable", async () => {
        const { result } = renderHook(() => useDisable2FA(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({
              password: "",
              token: "",
            });
          } catch (error) {
            expect(error).toBeDefined();
          }
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
      });
    });

    it("should handle complete 2FA setup flow", async () => {
      const wrapper = createQueryWrapper();

      // Step 1: Enable 2FA
      const { result: enableResult } = renderHook(() => useEnable2FA(), { wrapper });

      let setupData;
      await act(async () => {
        setupData = await enableResult.current.mutateAsync({ password: "password123" });
      });

      expect(setupData.secret).toBeDefined();
      expect(setupData.qr_code).toBeDefined();
      expect(setupData.backup_codes).toHaveLength(5);

      // Step 2: Verify 2FA
      const { result: verifyResult } = renderHook(() => useVerify2FA(), { wrapper });

      await act(async () => {
        await verifyResult.current.mutateAsync({ token: "123456" });
      });

      expect(verifyResult.current.data?.mfa_enabled).toBe(true);

      // Step 3: Disable 2FA
      const { result: disableResult } = renderHook(() => useDisable2FA(), { wrapper });

      await act(async () => {
        await disableResult.current.mutateAsync({
          password: "password123",
          token: "123456",
        });
      });

      expect(disableResult.current.data?.mfa_enabled).toBe(false);
    });
  });

  describe("useUploadAvatar", () => {
    it("should upload avatar successfully", async () => {
      const mockFile = new File(["avatar"], "avatar.jpg", { type: "image/jpeg" });
      (authService.uploadAvatar as jest.Mock).mockResolvedValue({
        avatar_url: "https://example.com/avatars/new-avatar.jpg",
      });

      const { result } = renderHook(() => useUploadAvatar(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(mockFile);
      });

      expect(authService.uploadAvatar).toHaveBeenCalledWith(mockFile);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("should handle upload avatar error", async () => {
      const mockFile = new File(["avatar"], "avatar.jpg", { type: "image/jpeg" });
      (authService.uploadAvatar as jest.Mock).mockRejectedValue(
        new Error("Upload failed")
      );

      const { result } = renderHook(() => useUploadAvatar(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync(mockFile);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeleteAccount", () => {
    it("should delete account with valid confirmation", async () => {
      seedProfileData({ email: "user@example.com" });

      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          confirmation: "DELETE",
          password: "password123",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockLocationHref).toHaveBeenCalledWith("/login?deleted=true");
    });

    it("should reject invalid confirmation text", async () => {
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            confirmation: "delete",
            password: "password123",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("Please type DELETE to confirm");
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mockLocationHref).not.toHaveBeenCalled();
    });

    it("should handle missing password", async () => {
      const { result } = renderHook(() => useDeleteAccount(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            confirmation: "DELETE",
            password: "",
          });
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useExportData", () => {
    it("should export user data as JSON file", async () => {
      seedProfileData({
        id: "user-export",
        email: "export@example.com",
        first_name: "Export",
        last_name: "User",
      });

      const { result } = renderHook(() => useExportData(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it("should include profile data in export", async () => {
      seedProfileData({
        id: "user-123",
        email: "test@example.com",
      });
      seed2FAEnabled(true);

      const { result } = renderHook(() => useExportData(), {
        wrapper: createQueryWrapper(),
      });

      let exportData;
      await act(async () => {
        exportData = await result.current.mutateAsync();
      });

      expect(exportData).toHaveProperty("profile");
      expect(exportData).toHaveProperty("two_factor_enabled");
      expect(exportData).toHaveProperty("exported_at");
    });
  });

  describe("Session Management", () => {
    describe("useListSessions", () => {
      it("should fetch active sessions", async () => {
        const mockSessions = [
          createMockSession({ session_id: "session-1" }),
          createMockSession({ session_id: "session-2" }),
        ];
        seedSessions(mockSessions);

        const { result } = renderHook(() => useListSessions(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.sessions).toHaveLength(2);
        expect(result.current.data?.total).toBe(2);
      });

      it("should return empty sessions list", async () => {
        seedSessions([]);

        const { result } = renderHook(() => useListSessions(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.sessions).toHaveLength(0);
        expect(result.current.data?.total).toBe(0);
      });
    });

    describe("useRevokeSession", () => {
      it("should revoke specific session", async () => {
        const mockSessions = [
          createMockSession({ session_id: "session-1" }),
          createMockSession({ session_id: "session-2" }),
        ];
        seedSessions(mockSessions);

        const { result } = renderHook(() => useRevokeSession(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync("session-1");
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ message: "Session revoked successfully" });
      });

      it("should handle non-existent session", async () => {
        seedSessions([]);

        const { result } = renderHook(() => useRevokeSession(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          try {
            await result.current.mutateAsync("non-existent");
          } catch (error) {
            expect(error).toBeDefined();
          }
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
      });
    });

    describe("useRevokeAllSessions", () => {
      it("should revoke all sessions", async () => {
        const mockSessions = [
          createMockSession({ session_id: "session-1" }),
          createMockSession({ session_id: "session-2" }),
          createMockSession({ session_id: "session-3" }),
        ];
        seedSessions(mockSessions);

        const { result } = renderHook(() => useRevokeAllSessions(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync();
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({
          message: "All sessions revoked successfully",
          sessions_revoked: 3,
        });
      });

      it("should handle no sessions to revoke", async () => {
        seedSessions([]);

        const { result } = renderHook(() => useRevokeAllSessions(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync();
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.sessions_revoked).toBe(0);
      });
    });

    it("should handle complete session management workflow", async () => {
      // Seed initial sessions
      const mockSessions = [
        createMockSession({ session_id: "session-1", ip_address: "192.168.1.1" }),
        createMockSession({ session_id: "session-2", ip_address: "192.168.1.2" }),
        createMockSession({ session_id: "session-3", ip_address: "192.168.1.3" }),
      ];
      seedSessions(mockSessions);

      const wrapper = createQueryWrapper();

      // Step 1: List sessions
      const { result: listResult } = renderHook(() => useListSessions(), { wrapper });

      await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
      expect(listResult.current.data?.sessions).toHaveLength(3);

      // Step 2: Revoke one session
      const { result: revokeResult } = renderHook(() => useRevokeSession(), { wrapper });

      await act(async () => {
        await revokeResult.current.mutateAsync("session-2");
      });

      await waitFor(() => expect(revokeResult.current.isSuccess).toBe(true));

      // Step 3: Revoke all remaining sessions
      const { result: revokeAllResult } = renderHook(() => useRevokeAllSessions(), {
        wrapper,
      });

      await act(async () => {
        await revokeAllResult.current.mutateAsync();
      });

      await waitFor(() => expect(revokeAllResult.current.data?.sessions_revoked).toBe(2));
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle profile update and avatar upload workflow", async () => {
      seedProfileData({
        first_name: "Original",
        last_name: "User",
      });

      const mockUpdatedUser = createMockUserData({
        first_name: "Updated",
        last_name: "User",
      });
      (authService.updateProfile as jest.Mock).mockResolvedValue(mockUpdatedUser);

      const mockFile = new File(["avatar"], "avatar.jpg", { type: "image/jpeg" });
      (authService.uploadAvatar as jest.Mock).mockResolvedValue({
        avatar_url: "https://example.com/avatars/new.jpg",
      });

      const wrapper = createQueryWrapper();

      // Step 1: Update profile
      const { result: profileResult } = renderHook(() => useUpdateProfile(), { wrapper });

      await act(async () => {
        await profileResult.current.mutateAsync({ first_name: "Updated" });
      });

      await waitFor(() => expect(profileResult.current.isSuccess).toBe(true));

      // Step 2: Upload avatar
      const { result: avatarResult } = renderHook(() => useUploadAvatar(), { wrapper });

      await act(async () => {
        await avatarResult.current.mutateAsync(mockFile);
      });

      await waitFor(() => expect(avatarResult.current.isSuccess).toBe(true));

      // Step 3: Change password
      const { result: passwordResult } = renderHook(() => useChangePassword(), { wrapper });

      await act(async () => {
        await passwordResult.current.mutateAsync({
          current_password: "oldpass",
          new_password: "newpass",
        });
      });

      await waitFor(() => expect(passwordResult.current.isSuccess).toBe(true));
    });

    it("should handle security hardening workflow", async () => {
      const wrapper = createQueryWrapper();

      // Step 1: Change password
      const { result: passwordResult } = renderHook(() => useChangePassword(), { wrapper });

      await act(async () => {
        await passwordResult.current.mutateAsync({
          current_password: "oldpass123",
          new_password: "newstrongpass456",
        });
      });

      await waitFor(() => expect(passwordResult.current.isSuccess).toBe(true));

      // Step 2: Enable 2FA
      const { result: enableResult } = renderHook(() => useEnable2FA(), { wrapper });

      let twoFactorSetup;
      await act(async () => {
        twoFactorSetup = await enableResult.current.mutateAsync({ password: "newstrongpass456" });
      });

      expect(twoFactorSetup.backup_codes).toBeDefined();

      // Step 3: Verify 2FA
      const { result: verifyResult } = renderHook(() => useVerify2FA(), { wrapper });

      await act(async () => {
        await verifyResult.current.mutateAsync({ token: "123456" });
      });

      await waitFor(() => expect(verifyResult.current.data?.mfa_enabled).toBe(true));

      // Step 4: Revoke all other sessions
      seedSessions([
        createMockSession({ session_id: "session-1" }),
        createMockSession({ session_id: "session-2" }),
      ]);

      const { result: revokeAllResult } = renderHook(() => useRevokeAllSessions(), {
        wrapper,
      });

      await act(async () => {
        await revokeAllResult.current.mutateAsync();
      });

      await waitFor(() => expect(revokeAllResult.current.data?.sessions_revoked).toBe(2));
    });

    it("should handle account lifecycle: setup -> secure -> export -> delete", async () => {
      const wrapper = createQueryWrapper();

      // Step 1: Update profile
      const mockUser = createMockUserData();
      (authService.updateProfile as jest.Mock).mockResolvedValue(mockUser);

      const { result: profileResult } = renderHook(() => useUpdateProfile(), { wrapper });

      await act(async () => {
        await profileResult.current.mutateAsync({
          first_name: "Complete",
          last_name: "User",
          bio: "Test bio",
        });
      });

      await waitFor(() => expect(profileResult.current.isSuccess).toBe(true));

      // Step 2: Enable 2FA
      const { result: enableResult } = renderHook(() => useEnable2FA(), { wrapper });

      await act(async () => {
        await enableResult.current.mutateAsync({ password: "password123" });
      });

      const { result: verifyResult } = renderHook(() => useVerify2FA(), { wrapper });

      await act(async () => {
        await verifyResult.current.mutateAsync({ token: "123456" });
      });

      await waitFor(() => expect(verifyResult.current.data?.mfa_enabled).toBe(true));

      // Step 3: Export data
      seedProfileData({ email: "complete@example.com" });
      seed2FAEnabled(true);

      const { result: exportResult } = renderHook(() => useExportData(), { wrapper });

      await act(async () => {
        await exportResult.current.mutateAsync();
      });

      await waitFor(() => expect(exportResult.current.isSuccess).toBe(true));
      expect(mockClick).toHaveBeenCalled();

      // Step 4: Delete account
      const { result: deleteResult } = renderHook(() => useDeleteAccount(), { wrapper });

      await act(async () => {
        await deleteResult.current.mutateAsync({
          confirmation: "DELETE",
          password: "password123",
        });
      });

      await waitFor(() => expect(deleteResult.current.isSuccess).toBe(true));
      expect(mockLocationHref).toHaveBeenCalledWith("/login?deleted=true");
    });
  });
});
