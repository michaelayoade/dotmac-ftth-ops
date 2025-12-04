/**
 * MSW Handlers for Profile Management API
 * Mocks user profile, password, 2FA, avatar, sessions, and account management
 */

import { http, HttpResponse } from "msw";

// Types
export interface MockSession {
  session_id: string;
  created_at: string;
  last_accessed?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface Mock2FASetup {
  secret: string;
  qr_code: string;
  backup_codes: string[];
  provisioning_uri: string;
}

export interface MockUserData {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  phone?: string;
  location?: string;
  timezone?: string;
  language?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
  mfa_enabled?: boolean;
}

// In-memory storage
let currentProfile: MockUserData | null = null;
let sessions: MockSession[] = [];
let twoFactorEnabled = false;
let twoFactorSecret: string | null = null;
let backupCodes: string[] = [];
let nextSessionId = 1;

// Factory functions
export function createMockSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    session_id: `session-${nextSessionId++}`,
    created_at: new Date().toISOString(),
    last_accessed: new Date().toISOString(),
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ...overrides,
  };
}

export function createMock2FASetup(overrides: Partial<Mock2FASetup> = {}): Mock2FASetup {
  const secret = `SECRET${Date.now()}`;
  return {
    secret,
    qr_code: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`,
    backup_codes: [
      "BACKUP-CODE-001",
      "BACKUP-CODE-002",
      "BACKUP-CODE-003",
      "BACKUP-CODE-004",
      "BACKUP-CODE-005",
      "BACKUP-CODE-006",
      "BACKUP-CODE-007",
      "BACKUP-CODE-008",
    ],
    provisioning_uri: `otpauth://totp/ISP-Ops:user@example.com?secret=${secret}&issuer=ISP-Ops`,
    ...overrides,
  };
}

export function createMockUserData(overrides: Partial<MockUserData> = {}): MockUserData {
  return {
    id: "user-123",
    email: "user@example.com",
    first_name: "Test",
    last_name: "User",
    username: "testuser",
    phone: "+1234567890",
    location: "San Francisco, CA",
    timezone: "America/Los_Angeles",
    language: "en",
    bio: "Software developer",
    website: "https://example.com",
    avatar_url: "https://example.com/avatars/user-123.jpg",
    mfa_enabled: false,
    ...overrides,
  };
}

// Seed/reset functions
export function seedProfileData(profile: Partial<MockUserData>): void {
  currentProfile = createMockUserData(profile);
}

export function seedSessions(sessionList: MockSession[]): void {
  sessions = sessionList;
  nextSessionId =
    sessionList.reduce((max, s) => {
      const id = parseInt(s.session_id.replace("session-", ""));
      return Math.max(max, isNaN(id) ? 0 : id);
    }, 0) + 1;
}

export function seed2FAEnabled(enabled: boolean): void {
  twoFactorEnabled = enabled;
  if (enabled && !twoFactorSecret) {
    twoFactorSecret = `SECRET${Date.now()}`;
    backupCodes = createMock2FASetup().backup_codes;
  }
  if (currentProfile) {
    currentProfile.mfa_enabled = enabled;
  }
}

export function clearProfileData(): void {
  currentProfile = null;
  sessions = [];
  twoFactorEnabled = false;
  twoFactorSecret = null;
  backupCodes = [];
  nextSessionId = 1;
}

export function resetProfileData(): void {
  clearProfileData();
}

export const profileHandlers = [
  // PUT /auth/me/profile - Update profile
  http.put("*/api/v1/auth/me/profile", async (req) => {
    const updates = await req.json<any>();

    if (!currentProfile) {
      currentProfile = {
        id: "user-123",
        email: "user@example.com",
        first_name: "User",
        last_name: "Test",
        username: "user123",
      };
    }

    currentProfile = { ...currentProfile, ...updates };
    return HttpResponse.json(currentProfile);
  }),

  // POST /auth/change-password - Change password
  http.post("*/api/v1/auth/change-password", async (req) => {
    const { current_password, new_password } = await req.json<any>();

    // Simulate validation
    if (!current_password || !new_password) {
      return HttpResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    return HttpResponse.json({ message: "Password changed successfully" });
  }),

  // POST /auth/verify-phone - Verify phone number
  http.post("*/api/v1/auth/verify-phone", async (req) => {
    const { phone } = await req.json<any>();

    if (!phone) {
      return HttpResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    return HttpResponse.json({
      message: "Phone verification initiated",
      verification_id: "verify-123",
    });
  }),

  // POST /auth/2fa/enable - Enable 2FA
  http.post("*/api/v1/auth/2fa/enable", async (req) => {
    const { password } = await req.json<any>();

    if (!password) {
      return HttpResponse.json({ error: "Password required" }, { status: 400 });
    }

    twoFactorSecret = `secret-${Date.now()}`;

    return HttpResponse.json({
      secret: twoFactorSecret,
      qr_code: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...`,
      backup_codes: ["code1", "code2", "code3", "code4", "code5"],
      provisioning_uri: `otpauth://totp/App:user@example.com?secret=${twoFactorSecret}`,
    });
  }),

  // POST /auth/2fa/verify - Verify 2FA token
  http.post("*/api/v1/auth/2fa/verify", async (req) => {
    const { token } = await req.json<any>();

    if (!token) {
      return HttpResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Simulate successful verification
    twoFactorEnabled = true;

    return HttpResponse.json({
      message: "2FA enabled successfully",
      mfa_enabled: true,
    });
  }),

  // POST /auth/2fa/disable - Disable 2FA
  http.post("*/api/v1/auth/2fa/disable", async (req) => {
    const { password, token } = await req.json<any>();

    if (!password || !token) {
      return HttpResponse.json({ error: "Password and token required" }, { status: 400 });
    }

    twoFactorEnabled = false;
    twoFactorSecret = null;

    return HttpResponse.json({
      message: "2FA disabled successfully",
      mfa_enabled: false,
    });
  }),

  // POST /auth/me/avatar - Upload avatar
  http.post("*/api/v1/auth/me/avatar", async (req) => {
    // Simulate file upload - in real API this would handle multipart/form-data
    return HttpResponse.json({
      avatar_url: "https://example.com/avatars/user-123.jpg",
      message: "Avatar uploaded successfully",
    });
  }),

  // DELETE /auth/me - Delete account
  http.delete("*/api/v1/auth/me", async ({ request }) => {
    const password = request.headers.get("X-Password");

    if (!password) {
      return HttpResponse.json({ error: "Password required" }, { status: 400 });
    }

    // Note: confirmation is validated in the hook itself before calling API
    // The API just checks the password header

    // Clear all user data
    currentProfile = null;
    sessions = [];
    twoFactorEnabled = false;
    twoFactorSecret = null;
    backupCodes = [];

    return HttpResponse.json({ message: "Account deleted successfully" });
  }),

  // GET /auth/me/export - Export user data
  http.get("*/api/v1/auth/me/export", ({ request }) => {
    const exportData = {
      profile: currentProfile || {
        id: "user-123",
        email: "user@example.com",
        first_name: "User",
        last_name: "Test",
      },
      sessions: sessions.length,
      two_factor_enabled: twoFactorEnabled,
      exported_at: new Date().toISOString(),
    };

    return HttpResponse.json(exportData);
  }),

  // GET /auth/me/sessions - List sessions
  http.get("*/api/v1/auth/me/sessions", ({ request }) => {
    return HttpResponse.json({
      sessions,
      total: sessions.length,
    });
  }),

  // DELETE /auth/me/sessions/:sessionId - Revoke specific session
  http.delete("*/api/v1/auth/me/sessions/:sessionId", ({ params }) => {
    const sessionId = params.sessionId as string;

    const initialLength = sessions.length;
    sessions = sessions.filter((s) => s.session_id !== sessionId);

    if (initialLength === sessions.length) {
      return HttpResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return HttpResponse.json({ message: "Session revoked successfully" });
  }),

  // DELETE /auth/me/sessions - Revoke all sessions
  http.delete("*/api/v1/auth/me/sessions", ({ request }) => {
    const sessionsRevoked = sessions.length;
    sessions = [];

    return HttpResponse.json({
      message: "All sessions revoked successfully",
      sessions_revoked: sessionsRevoked,
    });
  }),
];
