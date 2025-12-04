import { Page, APIResponse } from "@playwright/test";

export class GraphQLTestHelper {
  private page: Page;
  private baseURL: string;
  private authToken?: string;

  constructor(page: Page, baseURL: string = "http://localhost:8000") {
    this.page = page;
    this.baseURL = baseURL;
  }

  /**
   * Authenticate and store token for subsequent GraphQL calls
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
   * Execute GraphQL query
   */
  async executeQuery(
    query: string,
    variables?: Record<string, any>,
    operationName?: string,
  ): Promise<APIResponse> {
    return this.page.request.post(`${this.baseURL}/graphql`, {
      headers: this.getAuthHeaders(),
      data: {
        query,
        variables: variables || {},
        operationName,
      },
    });
  }

  /**
   * Execute GraphQL mutation
   */
  async executeMutation(
    mutation: string,
    variables?: Record<string, any>,
    operationName?: string,
  ): Promise<APIResponse> {
    return this.executeQuery(mutation, variables, operationName);
  }

  /**
   * Execute multiple GraphQL operations in batch
   */
  async executeBatch(
    operations: Array<{
      query: string;
      variables?: Record<string, any>;
      operationName?: string;
    }>,
  ): Promise<APIResponse> {
    return this.page.request.post(`${this.baseURL}/graphql`, {
      headers: this.getAuthHeaders(),
      data: operations,
    });
  }

  /**
   * Test GraphQL schema introspection
   */
  async introspectSchema(): Promise<APIResponse> {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
            description
            fields {
              name
              type {
                name
                kind
              }
            }
          }
          queryType {
            name
          }
          mutationType {
            name
          }
          subscriptionType {
            name
          }
        }
      }
    `;

    return this.executeQuery(introspectionQuery);
  }

  /**
   * Common User Queries
   */
  async getUsersQuery(variables?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<APIResponse> {
    const query = `
      query GetUsers($limit: Int, $offset: Int, $search: String) {
        users(limit: $limit, offset: $offset, search: $search) {
          id
          email
          fullName
          username
          roles
          isActive
          createdAt
          updatedAt
          permissions {
            id
            name
            resource
            actions
          }
          tenant {
            id
            name
          }
        }
      }
    `;

    return this.executeQuery(query, variables);
  }

  async getUserQuery(userId: string): Promise<APIResponse> {
    const query = `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          email
          fullName
          username
          roles
          isActive
          createdAt
          updatedAt
          lastLoginAt
          permissions {
            id
            name
            resource
            actions
          }
          tenant {
            id
            name
            settings {
              maxUsers
              features
            }
          }
          apiKeys {
            id
            name
            scopes
            createdAt
            lastUsedAt
          }
        }
      }
    `;

    return this.executeQuery(query, { id: userId });
  }

  /**
   * Common User Mutations
   */
  async createUserMutation(input: {
    email: string;
    fullName: string;
    username?: string;
    password: string;
    roles?: string[];
  }): Promise<APIResponse> {
    const mutation = `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          email
          fullName
          username
          roles
          isActive
          createdAt
        }
      }
    `;

    return this.executeMutation(mutation, { input });
  }

  async updateUserMutation(
    id: string,
    input: {
      fullName?: string;
      email?: string;
      roles?: string[];
      isActive?: boolean;
    },
  ): Promise<APIResponse> {
    const mutation = `
      mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
        updateUser(id: $id, input: $input) {
          id
          email
          fullName
          roles
          isActive
          updatedAt
        }
      }
    `;

    return this.executeMutation(mutation, { id, input });
  }

  async deleteUserMutation(id: string): Promise<APIResponse> {
    const mutation = `
      mutation DeleteUser($id: ID!) {
        deleteUser(id: $id)
      }
    `;

    return this.executeMutation(mutation, { id });
  }

  /**
   * Feature Flag Queries and Mutations
   */
  async getFeatureFlagsQuery(): Promise<APIResponse> {
    const query = `
      query GetFeatureFlags {
        featureFlags {
          id
          key
          name
          description
          strategy
          percentage
          userList
          tenantList
          isActive
          createdAt
          updatedAt
        }
      }
    `;

    return this.executeQuery(query);
  }

  async createFeatureFlagMutation(input: {
    key: string;
    name: string;
    description?: string;
    strategy: string;
    percentage?: number;
  }): Promise<APIResponse> {
    const mutation = `
      mutation CreateFeatureFlag($input: CreateFeatureFlagInput!) {
        createFeatureFlag(input: $input) {
          id
          key
          name
          description
          strategy
          percentage
          isActive
          createdAt
        }
      }
    `;

    return this.executeMutation(mutation, { input });
  }

  async evaluateFeatureFlagQuery(key: string, context?: Record<string, any>): Promise<APIResponse> {
    const query = `
      query EvaluateFeatureFlag($key: String!, $context: JSON) {
        evaluateFeatureFlag(key: $key, context: $context) {
          enabled
          variant
          payload
        }
      }
    `;

    return this.executeQuery(query, { key, context });
  }

  /**
   * File Queries and Mutations
   */
  async getFilesQuery(variables?: {
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<APIResponse> {
    const query = `
      query GetFiles($limit: Int, $offset: Int, $type: String) {
        files(limit: $limit, offset: $offset, type: $type) {
          id
          name
          size
          type
          path
          uploadedBy {
            id
            fullName
          }
          createdAt
          updatedAt
        }
      }
    `;

    return this.executeQuery(query, variables);
  }

  async deleteFileMutation(id: string): Promise<APIResponse> {
    const mutation = `
      mutation DeleteFile($id: ID!) {
        deleteFile(id: $id)
      }
    `;

    return this.executeMutation(mutation, { id });
  }

  /**
   * Subscription Queries
   */
  async subscribeToUserUpdates(): Promise<string> {
    return `
      subscription UserUpdates {
        userUpdated {
          id
          email
          fullName
          lastUpdated
          event
        }
      }
    `;
  }

  async subscribeToFileUploads(): Promise<string> {
    return `
      subscription FileUploads {
        fileUploaded {
          id
          name
          size
          uploadedBy {
            id
            fullName
          }
          createdAt
        }
      }
    `;
  }

  /**
   * Complex nested queries for testing
   */
  async getComplexUserDataQuery(userId: string): Promise<APIResponse> {
    const query = `
      query GetComplexUserData($id: ID!) {
        user(id: $id) {
          id
          email
          fullName
          tenant {
            id
            name
            users(limit: 10) {
              id
              fullName
              roles
            }
            files(limit: 5) {
              id
              name
              size
            }
            featureFlags {
              key
              name
              isActive
            }
          }
          permissions {
            id
            name
            resource
            actions
            tenant {
              id
              name
            }
          }
          auditLogs(limit: 10) {
            id
            event
            timestamp
            metadata
          }
        }
      }
    `;

    return this.executeQuery(query, { id: userId });
  }

  /**
   * Test utility methods
   */
  async createTestUser(): Promise<any> {
    const input = {
      email: `graphql-test-${Date.now()}@example.com`,
      fullName: "GraphQL Test User",
      username: `gqluser${Date.now()}`,
      password: "Test123!@#",
      roles: ["user"],
    };

    const response = await this.createUserMutation(input);
    if (!response.ok()) {
      throw new Error(`Failed to create test user: ${response.status()}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data.createUser;
  }

  async validateQueryComplexity(
    query: string,
    variables?: Record<string, any>,
  ): Promise<{
    valid: boolean;
    complexity?: number;
    errors?: string[];
  }> {
    const response = await this.executeQuery(query, variables);
    const data = await response.json();

    if (data.errors) {
      const complexityError = data.errors.find(
        (error: any) =>
          error.message.includes("Query depth limit") || error.message.includes("Query complexity"),
      );

      if (complexityError) {
        return {
          valid: false,
          errors: [complexityError.message],
        };
      }
    }

    return {
      valid: !data.errors,
      errors: data.errors?.map((e: any) => e.message),
    };
  }

  /**
   * Performance testing utilities
   */
  async measureQueryPerformance(
    query: string,
    variables?: Record<string, any>,
    iterations: number = 10,
  ): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    times: number[];
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await this.executeQuery(query, variables);
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    return {
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      times,
    };
  }

  /**
   * Cleanup test data
   */
  async cleanupTestData(userData: any[]): Promise<void> {
    for (const user of userData) {
      try {
        await this.deleteUserMutation(user.id);
      } catch (error) {
        console.warn(`Failed to cleanup user ${user.id}:`, error);
      }
    }
  }
}
