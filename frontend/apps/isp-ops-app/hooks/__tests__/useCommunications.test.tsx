/**
 * Jest Tests for useCommunications hook
 * Tests email/SMS communications system with Jest mocks
 */

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
import { communicationsService } from "@/lib/services/communications-service";

// Mock the communications service
jest.mock("@/lib/services/communications-service", () => ({
  communicationsService: {
    sendEmail: jest.fn(),
    queueEmail: jest.fn(),
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    renderTemplate: jest.fn(),
    quickRender: jest.fn(),
    listLogs: jest.fn(),
    getLog: jest.fn(),
    queueBulkEmail: jest.fn(),
    getBulkEmailStatus: jest.fn(),
    cancelBulkEmail: jest.fn(),
    getTaskStatus: jest.fn(),
    getStatistics: jest.fn(),
    getRecentActivity: jest.fn(),
    healthCheck: jest.fn(),
    getMetrics: jest.fn(),
  },
}));

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockService = communicationsService as jest.Mocked<typeof communicationsService>;

describe("useCommunications", () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("Email Operations", () => {
    describe("useSendEmail", () => {
      it("should send email successfully", async () => {
        const mockResponse = {
          status: "sent",
          message_id: "msg-123",
          recipient: "user@example.com",
          sent_at: "2024-01-01T00:00:00Z",
        };

        mockService.sendEmail.mockResolvedValue(mockResponse);

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
        expect(result.current.data?.message_id).toBe("msg-123");
      });
    });

    describe("useQueueEmail", () => {
      it("should queue email successfully", async () => {
        const mockResponse = {
          task_id: "task-123",
          status: "queued",
          queued_at: "2024-01-01T00:00:00Z",
        };

        mockService.queueEmail.mockResolvedValue(mockResponse);

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
        expect(result.current.data?.task_id).toBe("task-123");
        expect(result.current.data?.status).toBe("queued");
      });
    });
  });

  describe("Template Management", () => {
    describe("useTemplates", () => {
      it("should fetch templates successfully", async () => {
        const mockTemplates = {
          templates: [
            {
              id: "template-1",
              name: "Welcome Email",
              description: "Welcome new users",
              is_active: true,
              subject: "Welcome {{name}}",
              body_html: "<p>Welcome {{name}}</p>",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
            {
              id: "template-2",
              name: "Invoice Email",
              description: "Send invoices",
              is_active: true,
              subject: "Invoice {{invoice_number}}",
              body_html: "<p>Invoice details</p>",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 2,
          page: 1,
          page_size: 10,
        };

        mockService.listTemplates.mockResolvedValue(mockTemplates);

        const { result } = renderHook(() => useTemplates(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.templates).toHaveLength(2);
        expect(result.current.data?.total).toBe(2);
      });

      it("should filter templates by search", async () => {
        const mockTemplates = {
          templates: [
            {
              id: "template-1",
              name: "Welcome Email",
              is_active: true,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
            {
              id: "template-3",
              name: "Welcome SMS",
              is_active: true,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 2,
          page: 1,
          page_size: 10,
        };

        mockService.listTemplates.mockResolvedValue(mockTemplates);

        const { result } = renderHook(() => useTemplates({ search: "welcome" }), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.templates).toHaveLength(2);
      });

      it("should support pagination", async () => {
        const mockTemplates = {
          templates: Array.from({ length: 10 }, (_, i) => ({
            id: `template-${i + 1}`,
            name: `Template ${i + 1}`,
            is_active: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          })),
          total: 25,
          page: 1,
          page_size: 10,
          has_more: true,
        };

        mockService.listTemplates.mockResolvedValue(mockTemplates);

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
        const mockTemplate = {
          id: "template-123",
          name: "Test Template",
          subject: "{{title}}",
          body_html: "<p>{{content}}</p>",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        mockService.getTemplate.mockResolvedValue(mockTemplate);

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
        const mockTemplate = {
          id: "template-new",
          name: "New Template",
          description: "A new email template",
          subject: "Welcome {{name}}",
          body_html: "<p>Hello {{name}}</p>",
          body_text: "Hello {{name}}",
          variables: ["name"],
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        mockService.createTemplate.mockResolvedValue(mockTemplate);

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
        const mockTemplate = {
          id: "template-update-1",
          name: "Updated Name",
          description: "Updated description",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        mockService.updateTemplate.mockResolvedValue(mockTemplate);

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
        mockService.deleteTemplate.mockResolvedValue(undefined);

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
        const mockRender = {
          rendered_subject: "Hello John",
          rendered_body_html: "<p>Welcome John</p>",
          rendered_body_text: "Welcome John",
        };

        mockService.renderTemplate.mockResolvedValue(mockRender);

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
        expect(result.current.data?.rendered_subject).toBe("Hello John");
      });
    });

    describe("useQuickRender", () => {
      it("should quick render without template", async () => {
        const mockRender = {
          rendered_subject: "Test value",
          rendered_body_html: "<p>value</p>",
        };

        mockService.quickRender.mockResolvedValue(mockRender);

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
        const mockLogs = {
          logs: [
            {
              id: "log-1",
              type: "email",
              status: "sent",
              recipient: "user1@example.com",
              created_at: "2024-01-01T00:00:00Z",
            },
            {
              id: "log-2",
              type: "sms",
              status: "sent",
              recipient: "+1234567890",
              created_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 2,
        };

        mockService.listLogs.mockResolvedValue(mockLogs);

        const { result } = renderHook(() => useCommunicationLogs(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data?.logs).toHaveLength(2);
      });

      it("should filter logs by status", async () => {
        const mockLogs = {
          logs: [
            {
              id: "log-1",
              type: "email",
              status: "sent",
              recipient: "user1@example.com",
              created_at: "2024-01-01T00:00:00Z",
            },
            {
              id: "log-3",
              type: "email",
              status: "sent",
              recipient: "user2@example.com",
              created_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 2,
        };

        mockService.listLogs.mockResolvedValue(mockLogs);

        const { result } = renderHook(() => useCommunicationLogs({ status: "sent" }), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.logs).toHaveLength(2);
      });
    });

    describe("useCommunicationLog", () => {
      it("should fetch single log", async () => {
        const mockLog = {
          id: "log-123",
          type: "email",
          recipient: "test@example.com",
          subject: "Test Email",
          status: "sent",
          created_at: "2024-01-01T00:00:00Z",
        };

        mockService.getLog.mockResolvedValue(mockLog);

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
        const mockBulk = {
          id: "bulk-123",
          name: "Newsletter Campaign",
          status: "queued",
          total_count: 2,
          processed_count: 0,
          created_at: "2024-01-01T00:00:00Z",
        };

        mockService.queueBulkEmail.mockResolvedValue(mockBulk);

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
        const mockStatus = {
          operation: {
            id: "bulk-123",
            name: "Test Campaign",
            status: "processing",
            total_count: 100,
            processed_count: 50,
            progress: 50,
            created_at: "2024-01-01T00:00:00Z",
          },
          recent_logs: [],
        };

        mockService.getBulkEmailStatus.mockResolvedValue(mockStatus);

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
        const mockBulk = {
          id: "bulk-cancel-1",
          status: "cancelled",
          name: "Test Campaign",
          total_count: 100,
          processed_count: 50,
          created_at: "2024-01-01T00:00:00Z",
        };

        mockService.cancelBulkEmail.mockResolvedValue(mockBulk);

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
        const mockStats = {
          total_sent: 2,
          total_failed: 1,
          total_queued: 0,
          total_emails: 2,
          total_sms: 1,
          period_start: "2024-01-01T00:00:00Z",
          period_end: "2024-01-31T23:59:59Z",
        };

        mockService.getStatistics.mockResolvedValue(mockStats);

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
        const mockActivity = {
          activity: [
            {
              id: "log-1",
              created_at: "2025-01-01T10:00:00Z",
              type: "email",
              status: "sent",
            },
            {
              id: "log-2",
              created_at: "2025-01-01T10:05:00Z",
              type: "email",
              status: "sent",
            },
          ],
        };

        mockService.getRecentActivity.mockResolvedValue(mockActivity);

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
        const mockHealth = {
          smtp_available: true,
          redis_available: true,
          celery_available: true,
          overall_status: "healthy",
        };

        mockService.healthCheck.mockResolvedValue(mockHealth);

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
        const mockMetrics = {
          total_templates: 3,
          active_templates: 2,
          inactive_templates: 1,
          total_sent_today: 10,
          total_failed_today: 1,
        };

        mockService.getMetrics.mockResolvedValue(mockMetrics);

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
      const mockTemplate = {
        id: "template-new",
        name: "Campaign Template",
        subject: "Special Offer for {{name}}",
        body_html: "<p>Hello {{name}}, check this out!</p>",
        variables: ["name"],
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const mockBulk = {
        id: "bulk-new",
        name: "Q4 Campaign",
        status: "queued",
        total_count: 2,
        processed_count: 0,
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockStatus = {
        operation: {
          id: "bulk-new",
          name: "Q4 Campaign",
          status: "processing",
          total_count: 2,
          processed_count: 1,
          progress: 50,
          created_at: "2024-01-01T00:00:00Z",
        },
        recent_logs: [],
      };

      mockService.createTemplate.mockResolvedValue(mockTemplate);
      mockService.queueBulkEmail.mockResolvedValue(mockBulk);
      mockService.getBulkEmailStatus.mockResolvedValue(mockStatus);

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
      const { result: statusResult } = renderHook(() => useBulkOperationStatus(bulkId!), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(statusResult.current.isLoading).toBe(false));

      expect(statusResult.current.data?.operation.id).toBe(bulkId);
    });

    it("should handle template update and deletion", async () => {
      const mockUpdatedTemplate = {
        id: "template-workflow-1",
        name: "Updated",
        subject: "Updated Subject",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockService.updateTemplate.mockResolvedValue(mockUpdatedTemplate);
      mockService.deleteTemplate.mockResolvedValue(undefined);

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
