/**
 * Tests for case transformation utilities
 */

import {
  snakeToCamel,
  camelToSnake,
  transformKeysToCamel,
  transformKeysToSnake,
  transformUserProfile,
  transformProfileUpdate,
} from "@/lib/utils/case-transform";

describe("Case Transformation Utilities", () => {
  describe("snakeToCamel", () => {
    it("should convert snake_case to camelCase", () => {
      expect(snakeToCamel("first_name")).toBe("firstName");
      expect(snakeToCamel("last_login_at")).toBe("lastLoginAt");
      expect(snakeToCamel("is_active")).toBe("isActive");
    });

    it("should handle already camelCase strings", () => {
      expect(snakeToCamel("firstName")).toBe("firstName");
      expect(snakeToCamel("camelCase")).toBe("camelCase");
    });

    it("should handle single words", () => {
      expect(snakeToCamel("name")).toBe("name");
      expect(snakeToCamel("email")).toBe("email");
    });
  });

  describe("camelToSnake", () => {
    it("should convert camelCase to snake_case", () => {
      expect(camelToSnake("firstName")).toBe("first_name");
      expect(camelToSnake("lastLoginAt")).toBe("last_login_at");
      expect(camelToSnake("isActive")).toBe("is_active");
    });

    it("should handle already snake_case strings", () => {
      expect(camelToSnake("first_name")).toBe("first_name");
      expect(camelToSnake("snake_case")).toBe("snake_case");
    });

    it("should handle single words", () => {
      expect(camelToSnake("name")).toBe("name");
      expect(camelToSnake("email")).toBe("email");
    });
  });

  describe("transformKeysToCamel", () => {
    it("should transform object keys from snake_case to camelCase", () => {
      const input = {
        first_name: "John",
        last_name: "Doe",
        email_address: "john@example.com",
      };

      const expected = {
        firstName: "John",
        lastName: "Doe",
        emailAddress: "john@example.com",
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it("should handle nested objects", () => {
      const input = {
        user_info: {
          first_name: "John",
          contact_details: {
            phone_number: "123-456-7890",
          },
        },
      };

      const expected = {
        userInfo: {
          firstName: "John",
          contactDetails: {
            phoneNumber: "123-456-7890",
          },
        },
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it("should handle arrays", () => {
      const input = {
        user_list: [
          { first_name: "John", last_name: "Doe" },
          { first_name: "Jane", last_name: "Smith" },
        ],
      };

      const expected = {
        userList: [
          { firstName: "John", lastName: "Doe" },
          { firstName: "Jane", lastName: "Smith" },
        ],
      };

      expect(transformKeysToCamel(input)).toEqual(expected);
    });

    it("should handle null and undefined", () => {
      expect(transformKeysToCamel(null)).toBeNull();
      expect(transformKeysToCamel(undefined)).toBeUndefined();
    });
  });

  describe("transformKeysToSnake", () => {
    it("should transform object keys from camelCase to snake_case", () => {
      const input = {
        firstName: "John",
        lastName: "Doe",
        emailAddress: "john@example.com",
      };

      const expected = {
        first_name: "John",
        last_name: "Doe",
        email_address: "john@example.com",
      };

      expect(transformKeysToSnake(input)).toEqual(expected);
    });

    it("should handle nested objects", () => {
      const input = {
        userInfo: {
          firstName: "John",
          contactDetails: {
            phoneNumber: "123-456-7890",
          },
        },
      };

      const expected = {
        user_info: {
          first_name: "John",
          contact_details: {
            phone_number: "123-456-7890",
          },
        },
      };

      expect(transformKeysToSnake(input)).toEqual(expected);
    });

    it("should handle arrays", () => {
      const input = {
        userList: [
          { firstName: "John", lastName: "Doe" },
          { firstName: "Jane", lastName: "Smith" },
        ],
      };

      const expected = {
        user_list: [
          { first_name: "John", last_name: "Doe" },
          { first_name: "Jane", last_name: "Smith" },
        ],
      };

      expect(transformKeysToSnake(input)).toEqual(expected);
    });
  });

  describe("transformUserProfile", () => {
    it("should transform backend user profile to frontend format", () => {
      const backendUser = {
        id: "123",
        email: "john@example.com",
        username: "johndoe",
        first_name: "John",
        last_name: "Doe",
        full_name: "John Doe",
        avatar_url: "/avatars/123.jpg",
        phone_number: "123-456-7890",
        phone_verified: true,
        is_active: true,
        email_verified: true,
        last_login_at: "2024-01-01T00:00:00Z",
        location: "New York",
        timezone: "America/New_York",
        language: "en",
        bio: "Software developer",
        website: "https://johndoe.com",
      };

      const frontendUser = transformUserProfile(backendUser);

      expect(frontendUser).toMatchObject({
        id: "123",
        email: "john@example.com",
        username: "johndoe",
        firstName: "John",
        lastName: "Doe",
        displayName: "John Doe",
        avatar: "/avatars/123.jpg",
        phoneNumber: "123-456-7890",
        phoneVerified: true,
        status: "active",
        emailVerified: true,
        lastLogin: "2024-01-01T00:00:00Z",
        preferences: {
          location: "New York",
          timezone: "America/New_York",
          language: "en",
          bio: "Software developer",
          website: "https://johndoe.com",
        },
      });
    });

    it("should handle inactive users", () => {
      const backendUser = {
        id: "123",
        email: "john@example.com",
        is_active: false,
      };

      const frontendUser = transformUserProfile(backendUser);
      expect(frontendUser.status).toBe("inactive");
    });

    it("should handle null user", () => {
      expect(transformUserProfile(null)).toBeNull();
    });
  });

  describe("transformProfileUpdate", () => {
    it("should transform frontend profile update to backend format", () => {
      const frontendUpdate = {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "123-456-7890",
        preferences: {
          location: "New York",
          timezone: "America/New_York",
          language: "en",
          bio: "Software developer",
          website: "https://johndoe.com",
        },
      };

      const backendUpdate = transformProfileUpdate(frontendUpdate);

      expect(backendUpdate).toMatchObject({
        first_name: "John",
        last_name: "Doe",
        phone: "123-456-7890",
        location: "New York",
        timezone: "America/New_York",
        language: "en",
        bio: "Software developer",
        website: "https://johndoe.com",
      });

      // Should not include these fields
      expect(backendUpdate.avatar).toBeUndefined();
      expect(backendUpdate.display_name).toBeUndefined();
      expect(backendUpdate.preferences).toBeUndefined();
    });

    it("should handle partial updates", () => {
      const frontendUpdate = {
        firstName: "John",
      };

      const backendUpdate = transformProfileUpdate(frontendUpdate);

      expect(backendUpdate).toHaveProperty("first_name", "John");
      expect(Object.keys(backendUpdate).length).toBeGreaterThan(0);
    });

    it("should handle null update", () => {
      expect(transformProfileUpdate(null)).toEqual({});
    });
  });
});
