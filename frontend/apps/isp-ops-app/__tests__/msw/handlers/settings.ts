/**
 * MSW Handlers for Admin Settings API
 * Mocks admin settings management operations
 */

import { http, HttpResponse } from "msw";

// In-memory storage
let categories: any[] = [];
let categorySettings: Map<string, any> = new Map();
let auditLogs: any[] = [];
let nextAuditId = 1;

// Factory function for creating mock category info
function createMockCategory(category: string, displayName: string, fieldsCount: number = 5) {
  return {
    category,
    display_name: displayName,
    description: `Settings for ${displayName}`,
    fields_count: fieldsCount,
    has_sensitive_fields: category === "database" || category === "jwt" || category === "vault",
    restart_required: category === "database" || category === "redis",
    last_updated: new Date().toISOString(),
  };
}

// Factory function for creating mock settings
function createMockSettings(category: string, displayName: string) {
  return {
    category,
    display_name: displayName,
    fields: [
      {
        name: "host",
        value: "localhost",
        type: "string",
        description: "Server host",
        required: true,
        sensitive: false,
      },
      {
        name: "port",
        value: 5432,
        type: "integer",
        description: "Server port",
        required: true,
        sensitive: false,
      },
      {
        name: "password",
        value: "secret123",
        type: "string",
        description: "Server password",
        required: true,
        sensitive: true,
      },
    ],
    last_updated: new Date().toISOString(),
    updated_by: "admin@example.com",
  };
}

export function seedSettingsCategories(categoriesList: any[]): void {
  categories = categoriesList;
}

export function seedCategorySettings(category: string, settings: any): void {
  categorySettings.set(category, settings);
}

export function seedAuditLogs(logs: any[]): void {
  auditLogs = logs;
  nextAuditId =
    logs.reduce((max, log) => Math.max(max, parseInt(log.id.replace("audit-", ""))), 0) + 1;
}

export function clearSettingsData(): void {
  categories = [];
  categorySettings.clear();
  auditLogs = [];
  nextAuditId = 1;
}

export const settingsHandlers = [
  // GET /api/v1/admin/settings/categories - List all categories
  http.get("*/api/v1/admin/settings/categories", ({ request }) => {
    if (categories.length === 0) {
      // Return default categories
      categories = [
        createMockCategory("database", "Database Configuration", 8),
        createMockCategory("jwt", "JWT & Authentication", 6),
        createMockCategory("redis", "Redis Cache", 4),
        createMockCategory("email", "Email & SMTP", 7),
        createMockCategory("storage", "Object Storage (MinIO/S3)", 5),
      ];
    }

    return HttpResponse.json(categories);
  }),

  // GET /api/v1/admin/settings/category/:category - Get category settings
  http.get("*/api/v1/admin/settings/category/:category", ({ request, params }) => {
    const category = params.category as string;
    const url = new URL(request.url);
    const includeSensitive = url.searchParams.get("include_sensitive") === "true";

    let settings = categorySettings.get(category as string);

    if (!settings) {
      // Create default settings for the category
      const displayNames: Record<string, string> = {
        database: "Database Configuration",
        jwt: "JWT & Authentication",
        redis: "Redis Cache",
        email: "Email & SMTP",
        storage: "Object Storage",
      };

      settings = createMockSettings(
        category as string,
        displayNames[category as string] || (category as string),
      );
      categorySettings.set(category as string, settings);
    }

    // Filter sensitive fields if not requested
    if (!includeSensitive) {
      settings = {
        ...settings,
        fields: settings.fields.map((field: any) => ({
          ...field,
          value: field.sensitive ? "***" : field.value,
        })),
      };
    }

    return HttpResponse.json(settings);
  }),

  // PUT /api/v1/admin/settings/category/:category - Update category settings
  http.put("*/api/v1/admin/settings/category/:category", async (req) => {
    const { category } = req.params;
    const body = await req.json<any>();

    let settings =
      categorySettings.get(category as string) ||
      createMockSettings(category as string, category as string);

    // Apply updates
    if (body.updates) {
      settings.fields = settings.fields.map((field: any) => {
        if (body.updates.hasOwnProperty(field.name)) {
          return { ...field, value: body.updates[field.name] };
        }
        return field;
      });
    }

    settings.last_updated = new Date().toISOString();
    settings.updated_by = "admin@example.com";
    categorySettings.set(category as string, settings);

    // Create audit log
    const auditLog = {
      id: `audit-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      user_id: "user-123",
      user_email: "admin@example.com",
      category: category as string,
      action: "update",
      changes: body.updates || {},
      reason: body.reason || null,
      ip_address: "127.0.0.1",
      user_agent: "Mozilla/5.0",
    };
    auditLogs.push(auditLog);

    return HttpResponse.json(settings);
  }),

  // POST /api/v1/admin/settings/validate - Validate settings
  http.post("*/api/v1/admin/settings/validate", async (req) => {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const body = await req.json<any>();

    // Simulate validation
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    let restartRequired = false;

    // Basic validation rules
    if (body.port && (body.port < 1 || body.port > 65535)) {
      errors.port = "Port must be between 1 and 65535";
    }

    if (body.host && body.host.trim() === "") {
      errors.host = "Host cannot be empty";
    }

    if (category === "database" || category === "redis") {
      restartRequired = true;
      warnings.restart = "Application restart required for these changes";
    }

    const valid = Object.keys(errors).length === 0;

    return HttpResponse.json({
      valid,
      errors,
      warnings,
      restart_required: restartRequired,
    });
  }),

  // GET /api/v1/admin/settings/audit-logs - Get audit logs
  http.get("*/api/v1/admin/settings/audit-logs", ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const userId = url.searchParams.get("user_id");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    let filteredLogs = auditLogs;

    if (category) {
      filteredLogs = filteredLogs.filter((log) => log.category === category);
    }

    if (userId) {
      filteredLogs = filteredLogs.filter((log) => log.user_id === userId);
    }

    // Apply limit
    filteredLogs = filteredLogs.slice(0, limit);

    return HttpResponse.json(filteredLogs);
  }),
];
