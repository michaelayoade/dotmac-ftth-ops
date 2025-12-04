import { apiClient } from "../api/client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface NotificationPreferences {
  email_notifications?: boolean;
  security_alerts?: boolean;
  product_updates?: boolean;
  sms_notifications?: boolean;
}

export interface UserSettings {
  preferences?: {
    language?: string;
    timezone?: string;
    tz?: string;
  };
  language?: string;
}

export async function getUsers(): Promise<User[]> {
  const response = await apiClient.get<User[]>("/users");
  return response.data;
}

export async function getUserById(id: string): Promise<User> {
  const response = await apiClient.get<User>(`/users/${id}`);
  return response.data;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiClient.get<NotificationPreferences>("/user/notification-preferences");
  return response.data;
}

export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const response = await apiClient.patch<NotificationPreferences>(
    "/user/notification-preferences",
    preferences,
  );
  return response.data;
}

export async function getSettings(): Promise<UserSettings> {
  const response = await apiClient.get<UserSettings>("/user/settings");
  return response.data;
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const response = await apiClient.patch<UserSettings>("/user/settings", settings);
  return response.data;
}

export const userService = {
  getUsers,
  getUserById,
  getNotificationPreferences,
  updateNotificationPreferences,
  getSettings,
  updateSettings,
};
export default userService;
