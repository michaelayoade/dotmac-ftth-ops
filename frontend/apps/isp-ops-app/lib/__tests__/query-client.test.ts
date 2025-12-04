/**
 * Tests for query-client utilities
 * Tests TanStack Query helpers including query keys, optimistic updates, and cache invalidation
 */

import { QueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  optimisticHelpers,
  invalidateHelpers,
  createQueryClient,
} from "../query-client";

describe("query-client", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("queryKeys", () => {
    it("should have keys for all main entities", () => {
      expect(queryKeys).toHaveProperty("customers");
      expect(queryKeys).toHaveProperty("users");
      expect(queryKeys).toHaveProperty("rbac");
      expect(queryKeys).toHaveProperty("billing");
    });

    it("should generate customer keys correctly", () => {
      expect(queryKeys.customers.all).toEqual(["customers"]);
      expect(queryKeys.customers.lists()).toEqual(["customers", "list"]);
      expect(queryKeys.customers.list({ page: 1 })).toEqual(["customers", "list", { page: 1 }]);
      expect(queryKeys.customers.detail("123")).toEqual(["customers", "detail", "123"]);
    });

    it("should generate user keys correctly", () => {
      expect(queryKeys.users.all).toEqual(["users"]);
      expect(queryKeys.users.lists()).toEqual(["users", "list"]);
      expect(queryKeys.users.list({ search: "test" })).toEqual([
        "users",
        "list",
        { search: "test" },
      ]);
      expect(queryKeys.users.detail("456")).toEqual(["users", "detail", "456"]);
    });

    it("should generate RBAC keys correctly", () => {
      expect(queryKeys.rbac.all).toEqual(["rbac"]);
      expect(queryKeys.rbac.roles).toEqual(["rbac", "roles"]);
      expect(queryKeys.rbac.permissions).toEqual(["rbac", "permissions"]);
      expect(queryKeys.rbac.userPermissions("user-1")).toEqual([
        "rbac",
        "users",
        "user-1",
        "permissions",
      ]);
    });

    it("should generate billing keys correctly", () => {
      expect(queryKeys.billing.all).toEqual(["billing"]);
      expect(queryKeys.billing.plans).toEqual(["billing", "plans"]);
      expect(queryKeys.billing.subscriptions).toEqual(["billing", "subscriptions"]);
      expect(queryKeys.billing.invoices).toEqual(["billing", "invoices"]);
    });

    it("should generate nested customer keys", () => {
      expect(queryKeys.customers.activities("cust-1")).toEqual([
        "customers",
        "detail",
        "cust-1",
        "activities",
      ]);
      expect(queryKeys.customers.notes("cust-1")).toEqual([
        "customers",
        "detail",
        "cust-1",
        "notes",
      ]);
    });
  });

  describe("optimisticHelpers", () => {
    describe("addToList", () => {
      it("should add new item to empty list", () => {
        const queryKey = ["test", "list"];
        const newItem = { id: "1", name: "Item 1" };

        queryClient.setQueryData(queryKey, []);

        optimisticHelpers.addToList(queryClient, queryKey, newItem);

        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual([newItem]);
      });

      it("should add new item to existing list at end by default", () => {
        const queryKey = ["test", "list"];
        const existingItems = [{ id: "1", name: "Item 1" }];
        const newItem = { id: "2", name: "Item 2" };

        queryClient.setQueryData(queryKey, existingItems);

        optimisticHelpers.addToList(queryClient, queryKey, newItem);

        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual([...existingItems, newItem]);
      });

      it("should add new item at start when position is start", () => {
        const queryKey = ["test", "list"];
        const existingItems = [{ id: "1", name: "Item 1" }];
        const newItem = { id: "2", name: "Item 2" };

        queryClient.setQueryData(queryKey, existingItems);

        optimisticHelpers.addToList(queryClient, queryKey, newItem, {
          position: "start",
        });

        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual([newItem, ...existingItems]);
      });

      it("should handle adding to non-existent query", () => {
        const queryKey = ["test", "list"];
        const newItem = { id: "1", name: "Item 1" };

        optimisticHelpers.addToList(queryClient, queryKey, newItem);

        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual([newItem]);
      });
    });

    describe("updateInList", () => {
      it("should update item in list by id", () => {
        const queryKey = ["test", "list"];
        const items = [
          { id: "1", name: "Item 1" },
          { id: "2", name: "Item 2" },
        ];

        queryClient.setQueryData(queryKey, items);

        optimisticHelpers.updateInList(queryClient, queryKey, "2", {
          name: "Updated Item 2",
        });

        const data = queryClient.getQueryData<typeof items>(queryKey);
        expect(data).toEqual([
          { id: "1", name: "Item 1" },
          { id: "2", name: "Updated Item 2" },
        ]);
      });

      it("should preserve other items when updating", () => {
        const queryKey = ["test", "list"];
        const items = [
          { id: "1", name: "Item 1", other: "data" },
          { id: "2", name: "Item 2", other: "data" },
        ];

        queryClient.setQueryData(queryKey, items);

        optimisticHelpers.updateInList(queryClient, queryKey, "1", {
          name: "Updated",
        });

        const data = queryClient.getQueryData<typeof items>(queryKey);
        expect(data?.[0]).toEqual({
          id: "1",
          name: "Updated",
          other: "data",
        });
      });

      it("should handle updating non-existent item gracefully", () => {
        const queryKey = ["test", "list"];
        const items = [{ id: "1", name: "Item 1" }];

        queryClient.setQueryData(queryKey, items);

        optimisticHelpers.updateInList(queryClient, queryKey, "999", {
          name: "Not Found",
        });

        // Should not modify list
        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual(items);
      });
    });

    describe("updateItem", () => {
      it("should update detail query data", () => {
        const queryKey = ["test", "detail", "123"];
        const item = { id: "123", name: "Original" };

        queryClient.setQueryData(queryKey, item);

        optimisticHelpers.updateItem(queryClient, queryKey, {
          name: "Updated",
        });

        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual({ id: "123", name: "Updated" });
      });

      it("should preserve existing fields when updating", () => {
        const queryKey = ["test", "detail", "123"];
        const item = { id: "123", name: "Original", email: "test@example.com" };

        queryClient.setQueryData(queryKey, item);

        optimisticHelpers.updateItem(queryClient, queryKey, {
          name: "Updated",
        });

        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual({
          id: "123",
          name: "Updated",
          email: "test@example.com",
        });
      });

      it("should create item if query data does not exist", () => {
        const queryKey = ["test", "detail", "123"];
        const updates = { name: "New Item" };

        optimisticHelpers.updateItem(queryClient, queryKey, updates);

        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual(updates);
      });
    });

    describe("removeFromList", () => {
      it("should remove item from list by id", () => {
        const queryKey = ["test", "list"];
        const items = [
          { id: "1", name: "Item 1" },
          { id: "2", name: "Item 2" },
          { id: "3", name: "Item 3" },
        ];

        queryClient.setQueryData(queryKey, items);

        optimisticHelpers.removeFromList(queryClient, queryKey, "2");

        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual([
          { id: "1", name: "Item 1" },
          { id: "3", name: "Item 3" },
        ]);
      });

      it("should handle removing non-existent item", () => {
        const queryKey = ["test", "list"];
        const items = [{ id: "1", name: "Item 1" }];

        queryClient.setQueryData(queryKey, items);

        optimisticHelpers.removeFromList(queryClient, queryKey, "999");

        // Should not modify list
        const data = queryClient.getQueryData(queryKey);
        expect(data).toEqual(items);
      });
    });
  });

  describe("invalidateHelpers", () => {
    describe("invalidateAll", () => {
      it("should invalidate all queries for entity", async () => {
        const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

        await invalidateHelpers.invalidateAll(queryClient, ["customers"]);

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["customers"],
        });
      });
    });

    describe("invalidateLists", () => {
      it("should invalidate list queries for entity", async () => {
        const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

        await invalidateHelpers.invalidateLists(queryClient, ["customers"]);

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["customers", "list"],
          exact: false,
        });
      });
    });

    describe("invalidateDetail", () => {
      it("should invalidate specific detail query", async () => {
        const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

        await invalidateHelpers.invalidateDetail(queryClient, ["customers"], "123");

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["customers", "detail", "123"],
        });
      });
    });

    describe("invalidateRelated", () => {
      it("should invalidate multiple related queries", async () => {
        const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

        await invalidateHelpers.invalidateRelated(queryClient, [["customers"], ["users"]]);

        expect(invalidateSpy).toHaveBeenCalledTimes(2);
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["customers"],
        });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
      });
    });
  });

  describe("createQueryClient", () => {
    it("should create a new QueryClient instance", () => {
      const client = createQueryClient();

      expect(client).toBeInstanceOf(QueryClient);
    });

    it("should have default configuration", () => {
      const client = createQueryClient();

      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions).toBeDefined();
      expect(defaultOptions.queries).toBeDefined();
    });

    it("should have retry configuration", () => {
      const client = createQueryClient();

      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.retry).toBe(1);
    });

    it("should have staleTime configuration", () => {
      const client = createQueryClient();

      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000);
    });

    it("should have gcTime configuration", () => {
      const client = createQueryClient();

      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.gcTime).toBe(10 * 60 * 1000);
    });

    it("should disable refetchOnWindowFocus", () => {
      const client = createQueryClient();

      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
    });
  });

  describe("Integration tests", () => {
    it("should handle optimistic update with invalidation", async () => {
      const listKey = queryKeys.customers.lists();
      const detailKey = queryKeys.customers.detail("123");

      queryClient.setQueryData(listKey, [{ id: "123", name: "Original" }]);
      queryClient.setQueryData(detailKey, { id: "123", name: "Original" });

      // Optimistic update
      optimisticHelpers.updateInList(queryClient, listKey, "123", {
        name: "Optimistic",
      });
      optimisticHelpers.updateItem(queryClient, detailKey, {
        name: "Optimistic",
      });

      // Verify optimistic updates
      expect(queryClient.getQueryData(listKey)).toEqual([{ id: "123", name: "Optimistic" }]);
      expect(queryClient.getQueryData(detailKey)).toEqual({
        id: "123",
        name: "Optimistic",
      });

      // Invalidate
      await invalidateHelpers.invalidateAll(queryClient, ["customers"]);

      // Queries should be marked as stale
      // (actual refetch depends on query configuration)
    });
  });
});
