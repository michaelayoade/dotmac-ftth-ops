/**
 * Team Notifications Hook
 *
 * Custom hook for sending notifications to teams via role or explicit user lists
 */

import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import type { NotificationPriority, NotificationType } from "./useNotifications";

// ============================================================================
// Types
// ============================================================================

export interface TeamNotificationRequest {
  team_members?: string[]; // Array of user UUIDs
  role_filter?: string; // Role name (e.g., "admin", "support_agent")
  notification_type?: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  action_url?: string;
  action_label?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: Record<string, any>;
  auto_send?: boolean;
}

export interface TeamNotificationResponse {
  notifications_created: number;
  target_count: number;
  team_members?: string[];
  role_filter?: string;
  notification_type: string;
  priority: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useTeamNotifications() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendTeamNotification = useCallback(
    async (request: TeamNotificationRequest): Promise<TeamNotificationResponse> => {
      try {
        setIsLoading(true);
        setError(null);

        // Validate that either team_members or role_filter is provided
        if (!request.team_members && !request.role_filter) {
          throw new Error("Either team_members or role_filter must be provided");
        }

        const response = await apiClient.post<TeamNotificationResponse>("/notifications/team", {
          team_members: request.team_members,
          role_filter: request.role_filter,
          notification_type: request.notification_type || "system_announcement",
          title: request.title,
          message: request.message,
          priority: request.priority || "medium",
          action_url: request.action_url,
          action_label: request.action_label,
          related_entity_type: request.related_entity_type,
          related_entity_id: request.related_entity_id,
          metadata: request.metadata || {},
          auto_send: request.auto_send !== undefined ? request.auto_send : true,
        });

        return response.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to send team notification");
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    sendTeamNotification,
    isLoading,
    error,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get list of available roles for filtering
 */
export const AVAILABLE_ROLES = [
  { value: "admin", label: "Administrators" },
  { value: "support_agent", label: "Support Agents" },
  { value: "sales", label: "Sales Team" },
  { value: "technician", label: "Technicians" },
  { value: "manager", label: "Managers" },
  { value: "billing", label: "Billing Team" },
  { value: "noc", label: "Network Operations Center" },
] as const;

/**
 * Get role label from value
 */
export function getRoleLabel(role: string): string {
  const found = AVAILABLE_ROLES.find((r) => r.value === role);
  return found ? found.label : role;
}
