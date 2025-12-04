import { Page, APIResponse } from "@playwright/test";

export class APITestHelper {
  private page: Page;
  private baseURL: string;
  private authToken?: string;

  constructor(page: Page, baseURL: string = "http://localhost:8000") {
    this.page = page;
    this.baseURL = baseURL;
  }

  /**
   * Authenticate and store token for subsequent API calls
   */
  async authenticate(email: string, password: string): Promise<void> {
    const response = await this.page.request.post(`${this.baseURL}/auth/login`, {
      data: {
        email,
        password,
      },
    });

    if (response.ok()) {
      const data = await response.json();
      this.authToken = data.access_token;
    } else {
      throw new Error(`Authentication failed: ${response.status()}`);
    }
  }

  /**
   * Get auth headers with bearer token
   */
  private getAuthHeaders(): Record<string, string> {
    if (!this.authToken) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    return {
      Authorization: `Bearer ${this.authToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * User Management API calls
   */
  async createUser(userData: {
    email: string;
    username: string;
    full_name: string;
    password: string;
    roles: string[];
  }): Promise<APIResponse> {
    return this.page.request.post(`${this.baseURL}/users`, {
      headers: this.getAuthHeaders(),
      data: userData,
    });
  }

  async createTestUser(): Promise<any> {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      full_name: "Test User",
      password: "Test123!@#",
      roles: ["user"],
    };

    const response = await this.createUser(userData);
    if (!response.ok()) {
      throw new Error(`Failed to create test user: ${response.status()}`);
    }

    return response.json();
  }

  async updateUser(
    userId: string,
    updateData: Partial<{
      full_name: string;
      email: string;
      roles: string[];
    }>,
  ): Promise<APIResponse> {
    return this.page.request.patch(`${this.baseURL}/users/${userId}`, {
      headers: this.getAuthHeaders(),
      data: updateData,
    });
  }

  async deleteUser(userId: string): Promise<APIResponse> {
    return this.page.request.delete(`${this.baseURL}/users/${userId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  async getUser(userId: string): Promise<APIResponse> {
    return this.page.request.get(`${this.baseURL}/users/${userId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  async listUsers(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<APIResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.search) searchParams.set("search", params.search);

    const url = `${this.baseURL}/users${searchParams.toString() ? "?" + searchParams.toString() : ""}`;

    return this.page.request.get(url, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Feature Flags API calls
   */
  async createFeatureFlag(flagData: {
    key: string;
    name: string;
    description?: string;
    strategy: string;
    percentage?: number;
  }): Promise<APIResponse> {
    return this.page.request.post(`${this.baseURL}/feature-flags`, {
      headers: this.getAuthHeaders(),
      data: flagData,
    });
  }

  async toggleFeatureFlag(
    flagKey: string,
    updateData: {
      percentage?: number;
      enabled?: boolean;
    },
  ): Promise<APIResponse> {
    return this.page.request.patch(`${this.baseURL}/feature-flags/${flagKey}`, {
      headers: this.getAuthHeaders(),
      data: updateData,
    });
  }

  async deleteFeatureFlag(flagKey: string): Promise<APIResponse> {
    return this.page.request.delete(`${this.baseURL}/feature-flags/${flagKey}`, {
      headers: this.getAuthHeaders(),
    });
  }

  async evaluateFeatureFlag(flagKey: string, context?: Record<string, any>): Promise<APIResponse> {
    return this.page.request.post(`${this.baseURL}/feature-flags/${flagKey}/evaluate`, {
      headers: this.getAuthHeaders(),
      data: { context: context || {} },
    });
  }

  /**
   * File Management API calls
   */
  async uploadFile(
    filename: string,
    content: string | Buffer,
    metadata?: Record<string, any>,
  ): Promise<APIResponse> {
    const formData = new FormData();

    if (typeof content === "string") {
      formData.append("file", new Blob([content], { type: "text/plain" }), filename);
    } else {
      formData.append("file", new Blob([content]), filename);
    }

    if (metadata) {
      formData.append("metadata", JSON.stringify(metadata));
    }

    return this.page.request.post(`${this.baseURL}/files/upload`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
      multipart: {
        file: {
          name: filename,
          mimeType: "text/plain",
          buffer: Buffer.from(content),
        },
        ...(metadata && { metadata: JSON.stringify(metadata) }),
      },
    });
  }

  async deleteFile(fileId: string): Promise<APIResponse> {
    return this.page.request.delete(`${this.baseURL}/files/${fileId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  async getFile(fileId: string): Promise<APIResponse> {
    return this.page.request.get(`${this.baseURL}/files/${fileId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  async listFiles(params?: {
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<APIResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.type) searchParams.set("type", params.type);

    const url = `${this.baseURL}/files${searchParams.toString() ? "?" + searchParams.toString() : ""}`;

    return this.page.request.get(url, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * API Key Management
   */
  async createAPIKey(keyData: {
    name: string;
    scopes: string[];
    expires_at?: string;
  }): Promise<APIResponse> {
    return this.page.request.post(`${this.baseURL}/auth/api-keys`, {
      headers: this.getAuthHeaders(),
      data: keyData,
    });
  }

  async listAPIKeys(): Promise<APIResponse> {
    return this.page.request.get(`${this.baseURL}/auth/api-keys`, {
      headers: this.getAuthHeaders(),
    });
  }

  async deleteAPIKey(keyId: string): Promise<APIResponse> {
    return this.page.request.delete(`${this.baseURL}/auth/api-keys/${keyId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Health and Monitoring
   */
  async getHealth(): Promise<APIResponse> {
    return this.page.request.get(`${this.baseURL}/health`);
  }

  async getMetrics(): Promise<APIResponse> {
    return this.page.request.get(`${this.baseURL}/metrics`, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Audit Trail
   */
  async getAuditEvents(params?: {
    limit?: number;
    offset?: number;
    event_type?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<APIResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    if (params?.event_type) searchParams.set("event_type", params.event_type);
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    if (params?.start_date) searchParams.set("start_date", params.start_date);
    if (params?.end_date) searchParams.set("end_date", params.end_date);

    const url = `${this.baseURL}/audit${searchParams.toString() ? "?" + searchParams.toString() : ""}`;

    return this.page.request.get(url, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Utility methods
   */
  async waitForResponse(url: string, timeout: number = 30000): Promise<APIResponse> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const response = await this.page.request.get(url, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok()) {
          return response;
        }
      } catch (error) {
        // Continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Timeout waiting for response from ${url}`);
  }

  async createTestData(): Promise<{
    users: any[];
    files: any[];
    flags: any[];
  }> {
    const testData = {
      users: [],
      files: [],
      flags: [],
    };

    // Create test users
    for (let i = 0; i < 3; i++) {
      const user = await this.createTestUser();
      testData.users.push(user);
    }

    // Create test files
    for (let i = 0; i < 5; i++) {
      const response = await this.uploadFile(`test-file-${i}.txt`, `Test content for file ${i}`);
      if (response.ok()) {
        const file = await response.json();
        testData.files.push(file);
      }
    }

    // Create test feature flags
    const flags = [
      {
        key: "test-flag-1",
        name: "Test Flag 1",
        strategy: "percentage",
        percentage: 50,
      },
      { key: "test-flag-2", name: "Test Flag 2", strategy: "user_list" },
      { key: "test-flag-3", name: "Test Flag 3", strategy: "all_off" },
    ];

    for (const flagData of flags) {
      const response = await this.createFeatureFlag(flagData);
      if (response.ok()) {
        const flag = await response.json();
        testData.flags.push(flag);
      }
    }

    return testData;
  }

  async cleanupTestData(testData: { users?: any[]; files?: any[]; flags?: any[] }): Promise<void> {
    // Cleanup in reverse order to handle dependencies

    // Delete feature flags
    if (testData.flags) {
      for (const flag of testData.flags) {
        try {
          await this.deleteFeatureFlag(flag.key);
        } catch (error) {
          console.warn(`Failed to cleanup flag ${flag.key}:`, error);
        }
      }
    }

    // Delete files
    if (testData.files) {
      for (const file of testData.files) {
        try {
          await this.deleteFile(file.id);
        } catch (error) {
          console.warn(`Failed to cleanup file ${file.id}:`, error);
        }
      }
    }

    // Delete users
    if (testData.users) {
      for (const user of testData.users) {
        try {
          await this.deleteUser(user.id);
        } catch (error) {
          console.warn(`Failed to cleanup user ${user.id}:`, error);
        }
      }
    }
  }
}
