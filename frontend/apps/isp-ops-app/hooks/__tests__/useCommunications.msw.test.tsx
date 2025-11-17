/**
 * MSW Tests for useCommunications hook
 * Tests email/SMS communications system with realistic API mocking
 */

// Mock platformConfig to provide a base URL for MSW to intercept
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import {
  useSendEmail,
  useQueueEmail,
  useTemplates,
  useTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useRenderTemplate,
  useQuickRender,
  useCommunicationLogs,
  useCommunicationLog,
  useQueueBulk,
  useBulkOperationStatus,
  useCancelBulk,
  useTaskStatus,
  useCommunicationStats,
  useCommunicationActivity,
  useCommunicationHealth,
  useCommunicationMetrics,
} from "../useCommunications";
import {
  seedTemplates,
  seedLogs,
  seedBulkOperations,
  clearCommunicationsData,
} from "@/__tests__/msw/handlers/communications";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useCommunications", () => {
  beforeEach(() => {
    clearCommunicationsData();
  });

  describe("Email Operations", () => {
    describe("useSendEmail", () => {
      it("should send email successfully", async () => {
        const { result } = renderHook(() => useSendEmail(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            to: "user@example.com",
            subject: "Test Email",
            body_html: "<p>Test message</p>",
            body_text: "Test message",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.status).toBe("sent");
        expect(result.current.data?.message_id).toBeDefined();
      });
    });

    describe("useQueueEmail", () => {
      it("should queue email successfully", async () => {
        const { result } = renderHook(() => useQueueEmail(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            to: "user@example.com",
            subject: "Queued Email",
            body_html: "<p>Queued message</p>",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.task_id).toBeDefined();
        expect(result.current.data?.status).toBe("queued");
      });
    });
  });

  describe("Template Management", () => {
    describe("useTemplates", () => {
      it("should fetch templates successfully", async () => {
        seedTemplates([
          {
            id: "template-1",
            name: "Welcome Email",
            description: "Welcome new users",
            is_active: true,
          },
          {
            id: "template-2",
            name: "Invoice Email",
            description: "Send invoices",
            is_active: true,
          },
        ]);

        const { result } = renderHook(() => useTemplates(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.templates).toHaveLength(2);
        expect(result.current.data?.total).toBe(2);
      });

      it("should filter templates by search", async () => {
        seedTemplates([
          { name: "Welcome Email" },
          { name: "Invoice Email" },
          { name: "Welcome SMS" },
        ]);

        const { result } = renderHook(() => useTemplates({ search: "welcome" }), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.templates).toHaveLength(2);
      });

      it("should support pagination", async () => {
        seedTemplates(
          Array.from({ length: 25 }, (_, i) => ({
            id: `template-${i + 1}`,
            name: `Template ${i + 1}`,
          }))
        );

        const { result } = renderHook(() => useTemplates({ page: 1, page_size: 10 }), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.templates).toHaveLength(10);
        expect(result.current.data?.has_more).toBe(true);
      });
    });

    describe("useTemplate", () => {
      it("should fetch single template successfully", async () => {
        seedTemplates([
          {
            id: "template-123",
            name: "Test Template",
            subject: "{{title}}",
            body_html: "<p>{{content}}</p>",
          },
        ]);

        const { result } = renderHook(() => useTemplate("template-123"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.id).toBe("template-123");
        expect(result.current.data?.subject).toBe("{{title}}");
      });

      it("should not fetch when id is null", () => {
        const { result } = renderHook(() => useTemplate(null), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
      });
    });

    describe("useCreateTemplate", () => {
      it("should create template successfully", async () => {
        const { result } = renderHook(() => useCreateTemplate(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            name: "New Template",
            description: "A new email template",
            subject: "Welcome {{name}}",
            body_html: "<p>Hello {{name}}</p>",
            body_text: "Hello {{name}}",
            variables: ["name"],
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.name).toBe("New Template");
      });
    });

    describe("useUpdateTemplate", () => {
      it("should update template successfully", async () => {
        seedTemplates([
          {
            id: "template-update-1",
            name: "Old Name",
            description: "Old description",
          },
        ]);

        const { result } = renderHook(() => useUpdateTemplate(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            id: "template-update-1",
            updates: {
              name: "Updated Name",
              description: "Updated description",
            },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.name).toBe("Updated Name");
      });
    });

    describe("useDeleteTemplate", () => {
      it("should delete template successfully", async () => {
        seedTemplates([
          {
            id: "template-delete-1",
            name: "To Delete",
          },
        ]);

        const { result } = renderHook(() => useDeleteTemplate(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync("template-delete-1");
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
      });
    });

    describe("useRenderTemplate", () => {
      it("should render template with variables", async () => {
        seedTemplates([
          {
            id: "template-render-1",
            subject: "Hello {{name}}",
            body_html: "<p>Welcome {{name}}</p>",
          },
        ]);

        const { result } = renderHook(() => useRenderTemplate(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            id: "template-render-1",
            variables: { name: "John" },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.rendered_subject).toBeDefined();
      });
    });

    describe("useQuickRender", () => {
      it("should quick render without template", async () => {
        const { result } = renderHook(() => useQuickRender(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            subject: "Test {{var}}",
            body_html: "<p>{{var}}</p>",
            variables: { var: "value" },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.rendered_subject).toBeDefined();
      });
    });
  });

  describe("Communication Logs", () => {
    describe("useCommunicationLogs", () => {
      it("should fetch logs successfully", async () => {
        seedLogs([
          {
            id: "log-1",
            type: "email",
            status: "sent",
            recipient: "user1@example.com",
          },
          {
            id: "log-2",
            type: "sms",
            status: "sent",
            recipient: "+1234567890",
          },
        ]);

        const { result } = renderHook(() => useCommunicationLogs(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.logs).toHaveLength(2);
      });

      it("should filter logs by status", async () => {
        seedLogs([
          { status: "sent" },
          { status: "failed" },
          { status: "sent" },
        ]);

        const { result } = renderHook(() => useCommunicationLogs({ status: "sent" }), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.logs).toHaveLength(2);
      });
    });

    describe("useCommunicationLog", () => {
      it("should fetch single log", async () => {
        seedLogs([
          {
            id: "log-123",
            type: "email",
            recipient: "test@example.com",
            subject: "Test Email",
          },
        ]);

        const { result } = renderHook(() => useCommunicationLog("log-123"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.id).toBe("log-123");
      });
    });
  });

  describe("Bulk Operations", () => {
    describe("useQueueBulk", () => {
      it("should queue bulk operation successfully", async () => {
        const { result } = renderHook(() => useQueueBulk(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            name: "Newsletter Campaign",
            template_id: "template-1",
            recipients: ["user1@example.com", "user2@example.com"],
            variables: { campaign: "Q4 Newsletter" },
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.status).toBe("queued");
      });
    });

    describe("useBulkOperationStatus", () => {
      it("should fetch bulk operation status", async () => {
        seedBulkOperations([
          {
            id: "bulk-123",
            name: "Test Campaign",
            status: "processing",
            total_count: 100,
            processed_count: 50,
            progress: 50,
          },
        ]);

        const { result } = renderHook(() => useBulkOperationStatus("bulk-123"), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.operation.progress).toBe(50);
      });
    });

    describe("useCancelBulk", () => {
      it("should cancel bulk operation", async () => {
        seedBulkOperations([
          {
            id: "bulk-cancel-1",
            status: "processing",
          },
        ]);

        const { result } = renderHook(() => useCancelBulk(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync("bulk-cancel-1");
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.status).toBe("cancelled");
      });
    });
  });

  describe("Statistics & Analytics", () => {
    describe("useCommunicationStats", () => {
      it("should fetch communication statistics", async () => {
        seedLogs([
          { status: "sent" },
          { status: "sent" },
          { status: "failed" },
        ]);

        const { result } = renderHook(() => useCommunicationStats(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.total_sent).toBe(2);
        expect(result.current.data?.total_failed).toBe(1);
      });
    });

    describe("useCommunicationActivity", () => {
      it("should fetch recent activity", async () => {
        seedLogs([
          { id: "log-1", created_at: "2025-01-01T10:00:00Z" },
          { id: "log-2", created_at: "2025-01-01T10:05:00Z" },
        ]);

        const { result } = renderHook(() => useCommunicationActivity(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.activity).toBeDefined();
      });
    });

    describe("useCommunicationHealth", () => {
      it("should fetch health status", async () => {
        const { result } = renderHook(() => useCommunicationHealth(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.smtp_available).toBe(true);
        expect(result.current.data?.redis_available).toBe(true);
      });
    });

    describe("useCommunicationMetrics", () => {
      it("should fetch metrics", async () => {
        seedTemplates([
          { is_active: true },
          { is_active: true },
          { is_active: false },
        ]);

        const { result } = renderHook(() => useCommunicationMetrics(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.total_templates).toBe(3);
        expect(result.current.data?.active_templates).toBe(2);
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle complete email campaign workflow", async () => {
      // Create template
      const { result: createResult } = renderHook(() => useCreateTemplate(), {
        wrapper: createQueryWrapper(),
      });

      let templateId: string;

      await act(async () => {
        const template = await createResult.current.mutateAsync({
          name: "Campaign Template",
          subject: "Special Offer for {{name}}",
          body_html: "<p>Hello {{name}}, check this out!</p>",
          variables: ["name"],
        });
        templateId = template.id;
      });

      // Queue bulk operation
      const { result: bulkResult } = renderHook(() => useQueueBulk(), {
        wrapper: createQueryWrapper(),
      });

      let bulkId: string;

      await act(async () => {
        const bulk = await bulkResult.current.mutateAsync({
          name: "Q4 Campaign",
          template_id: templateId!,
          recipients: ["user1@example.com", "user2@example.com"],
          variables: { name: "User" },
        });
        bulkId = bulk.id;
      });

      // Check status
      const { result: statusResult } = renderHook(
        () => useBulkOperationStatus(bulkId!),
        { wrapper: createQueryWrapper() }
      );

      await waitFor(() => expect(statusResult.current.isLoading).toBe(false));

      expect(statusResult.current.data?.operation.id).toBe(bulkId);
    });

    it("should handle template update and deletion", async () => {
      // Create template
      seedTemplates([
        {
          id: "template-workflow-1",
          name: "Original",
          subject: "Original Subject",
        },
      ]);

      // Update
      const { result: updateResult } = renderHook(() => useUpdateTemplate(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await updateResult.current.mutateAsync({
          id: "template-workflow-1",
          updates: {
            name: "Updated",
            subject: "Updated Subject",
          },
        });
      });

      await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));
      expect(updateResult.current.data?.name).toBe("Updated");

      // Delete
      const { result: deleteResult } = renderHook(() => useDeleteTemplate(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await deleteResult.current.mutateAsync("template-workflow-1");
      });

      await waitFor(() => expect(deleteResult.current.isSuccess).toBe(true));
    });
  });
});
