/**
 * Profile Management Hook
 * React Query hook for managing user profile data
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@/types/auth";
import { logger } from "@/lib/logger";
import apiClient from "@/lib/api/client";

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
  phone?: string;
  location?: string;
  timezone?: string;
  language?: string;
  bio?: string;
  website?: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface Session {
  session_id: string;
  created_at: string;
  last_accessed?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Hook to update user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      logger.info("Updating profile", { fields: Object.keys(data) });
      const response = await apiClient.patch<User>("/auth/profile", data);
      return response.data;
    },
    onSuccess: (data) => {
      // Update the user in auth context
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      logger.info("Profile updated successfully", { userId: data?.id });
    },
    onError: (error: Error) => {
      logger.error("Failed to update profile", error);
    },
  });
}

/**
 * Hook to change password
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      logger.info("Changing password");

      // Use the new change-password endpoint
      const response = await apiClient.post<{ message: string }>("/auth/change-password", data);

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to change password");
      }

      return response.data;
    },
    onSuccess: () => {
      logger.info("Password changed successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to change password", error);
    },
  });
}

/**
 * Hook to verify phone number
 */
export function useVerifyPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phone: string) => {
      logger.info("Verifying phone number");

      const response = await apiClient.post<{ message: string }>("/auth/verify-phone", { phone });

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to verify phone");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      logger.info("Phone verified successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to verify phone", error);
    },
  });
}

export interface Enable2FAData {
  password: string;
}

export interface Enable2FAResponse {
  secret: string;
  qr_code: string;
  backup_codes: string[];
  provisioning_uri: string;
}

export interface Verify2FAData {
  token: string;
}

export interface Disable2FAData {
  password: string;
  token: string;
}

/**
 * Hook to enable 2FA
 */
export function useEnable2FA() {
  return useMutation({
    mutationFn: async (data: Enable2FAData) => {
      logger.info("Enabling 2FA");

      const response = await apiClient.post<Enable2FAResponse>("/auth/2fa/enable", data);

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to enable 2FA");
      }

      return response.data;
    },
    onSuccess: () => {
      logger.info("2FA setup initiated successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to enable 2FA", error);
    },
  });
}

/**
 * Hook to verify 2FA token and complete setup
 */
export function useVerify2FA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Verify2FAData) => {
      logger.info("Verifying 2FA token");

      const response = await apiClient.post<{
        message: string;
        mfa_enabled: boolean;
      }>("/auth/2fa/verify", data);

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to verify 2FA");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      logger.info("2FA enabled successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to verify 2FA", error);
    },
  });
}

/**
 * Hook to disable 2FA
 */
export function useDisable2FA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Disable2FAData) => {
      logger.info("Disabling 2FA");

      const response = await apiClient.post<{
        message: string;
        mfa_enabled: boolean;
      }>("/auth/2fa/disable", data);

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to disable 2FA");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      logger.info("2FA disabled successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to disable 2FA", error);
    },
  });
}

/**
 * Hook to upload avatar
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      logger.info("Uploading avatar", { fileName: file.name, size: file.size });
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await apiClient.post<{ avatar_url: string }>(
        "/auth/profile/avatar",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      logger.info("Avatar uploaded successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to upload avatar", error);
    },
  });
}

/**
 * Hook to delete account
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (data: { confirmation: string; password: string }) => {
      if (data.confirmation !== "DELETE") {
        throw new Error("Please type DELETE to confirm");
      }

      logger.warn("Deleting account");

      const response = await apiClient.delete<{ message: string }>("/auth/me", {
        headers: { "X-Password": data.password },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to delete account");
      }

      return response.data;
    },
    onSuccess: () => {
      logger.info("Account deleted successfully");
      // Redirect to login page after account deletion
      window.location.href = "/login?deleted=true";
    },
    onError: (error: Error) => {
      logger.error("Failed to delete account", error);
    },
  });
}

/**
 * Hook to export user data
 */
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      logger.info("Exporting user data");

      const response = await apiClient.get<any>("/auth/me/export");

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to export data");
      }

      return response.data;
    },
    onSuccess: (data) => {
      // Download the data as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profile-data-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logger.info("Profile data exported successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to export data", error);
    },
  });
}

/**
 * Hook to list active sessions
 */
export function useListSessions() {
  return useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: async () => {
      logger.info("Fetching active sessions");

      const response = await apiClient.get<{
        sessions: Session[];
        total: number;
      }>("/auth/me/sessions");

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to fetch sessions");
      }

      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to revoke a specific session
 */
export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      logger.info("Revoking session", { sessionId });

      const response = await apiClient.delete<{ message: string }>(
        `/auth/me/sessions/${sessionId}`,
      );

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to revoke session");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
      logger.info("Session revoked successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to revoke session", error);
    },
  });
}

/**
 * Hook to revoke all sessions except current
 */
export function useRevokeAllSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      logger.info("Revoking all sessions");

      const response = await apiClient.delete<{
        message: string;
        sessions_revoked: number;
      }>("/auth/me/sessions");

      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to revoke sessions");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
      logger.info("All sessions revoked successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to revoke all sessions", error);
    },
  });
}
