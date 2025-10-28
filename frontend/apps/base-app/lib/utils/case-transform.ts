/**
 * Case transformation utilities for converting between snake_case and camelCase
 * Used for transforming API responses and requests between backend and frontend formats
 */

// ============================================================================
// Basic Case Transformers
// ============================================================================

/**
 * Convert snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// ============================================================================
// Object Key Transformers
// ============================================================================

/**
 * Recursively transform object keys from snake_case to camelCase
 */
export function transformKeysToCamel<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(transformKeysToCamel) as T;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  const result: any = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = transformKeysToCamel(obj[key]);
    }
  }

  return result;
}

/**
 * Recursively transform object keys from camelCase to snake_case
 */
export function transformKeysToSnake<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(transformKeysToSnake) as T;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  const result: any = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = transformKeysToSnake(obj[key]);
    }
  }

  return result;
}

// ============================================================================
// User Profile Transformers
// ============================================================================

interface BackendUserProfile {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
  phone_number?: string;
  phone_verified?: boolean;
  is_active?: boolean;
  email_verified?: boolean;
  last_login_at?: string;
  location?: string;
  timezone?: string;
  language?: string;
  bio?: string;
  website?: string;
}

interface FrontendUserProfile {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  status: "active" | "inactive";
  emailVerified?: boolean;
  lastLogin?: string;
  preferences?: {
    location?: string;
    timezone?: string;
    language?: string;
    bio?: string;
    website?: string;
  };
}

/**
 * Transform backend user profile to frontend format
 */
export function transformUserProfile(
  backendUser: BackendUserProfile | null
): FrontendUserProfile | null {
  if (!backendUser) {
    return null;
  }

  return {
    id: backendUser.id,
    email: backendUser.email,
    username: backendUser.username,
    firstName: backendUser.first_name,
    lastName: backendUser.last_name,
    displayName: backendUser.full_name,
    avatar: backendUser.avatar_url,
    phoneNumber: backendUser.phone_number,
    phoneVerified: backendUser.phone_verified,
    status: backendUser.is_active === false ? "inactive" : "active",
    emailVerified: backendUser.email_verified,
    lastLogin: backendUser.last_login_at,
    preferences: {
      location: backendUser.location,
      timezone: backendUser.timezone,
      language: backendUser.language,
      bio: backendUser.bio,
      website: backendUser.website,
    },
  };
}

interface FrontendProfileUpdate {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  preferences?: {
    location?: string;
    timezone?: string;
    language?: string;
    bio?: string;
    website?: string;
  };
}

interface BackendProfileUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string;
  location?: string;
  timezone?: string;
  language?: string;
  bio?: string;
  website?: string;
}

/**
 * Transform frontend profile update to backend format
 */
export function transformProfileUpdate(
  frontendUpdate: FrontendProfileUpdate | null
): BackendProfileUpdate {
  if (!frontendUpdate) {
    return {};
  }

  const backendUpdate: BackendProfileUpdate = {};

  if (frontendUpdate.firstName !== undefined) {
    backendUpdate.first_name = frontendUpdate.firstName;
  }

  if (frontendUpdate.lastName !== undefined) {
    backendUpdate.last_name = frontendUpdate.lastName;
  }

  if (frontendUpdate.phoneNumber !== undefined) {
    backendUpdate.phone = frontendUpdate.phoneNumber;
  }

  // Flatten preferences into top-level backend fields
  if (frontendUpdate.preferences) {
    const prefs = frontendUpdate.preferences;

    if (prefs.location !== undefined) {
      backendUpdate.location = prefs.location;
    }

    if (prefs.timezone !== undefined) {
      backendUpdate.timezone = prefs.timezone;
    }

    if (prefs.language !== undefined) {
      backendUpdate.language = prefs.language;
    }

    if (prefs.bio !== undefined) {
      backendUpdate.bio = prefs.bio;
    }

    if (prefs.website !== undefined) {
      backendUpdate.website = prefs.website;
    }
  }

  return backendUpdate;
}
