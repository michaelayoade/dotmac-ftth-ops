/**
 * Tests for useCommunications hooks
 * Tests communications management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
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
  useCommunicationsDashboard,
  useMonitorBulkOperation,
  useMonitorTask,
  useTemplateWithPreview,
  communicationsKeys,
} from "../useCommunications";
import { communicationsService } from "@/lib/services/communications-service";
import type {
  SendEmailResponse,
  QueueEmailResponse,
  CommunicationTemplate,
  CommunicationLog,
  BulkOperation,
  BulkOperationStatusResponse,
  TaskStatusResponse,
  CommunicationStats,
  ActivityResponse,
  HealthResponse,
  MetricsResponse,
  RenderTemplateResponse,
} from "@/types/communications";

// Mock dependencies
jest.mock("@/lib/services/communications-service");
jest.mock("@/lib/logger");

describe("useCommunications", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("communicationsKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(communicationsKeys.all).toEqual(["communications"]);
      expect(communicationsKeys.logs.all).toEqual(["communications", "logs"]);
      expect(communicationsKeys.logs.list({ page: 1 })).toEqual([
        "communications",
        "logs",
        "list",
        { page: 1 },
      ]);
      expect(communicationsKeys.logs.detail("log-1")).toEqual([
        "communications",
        "logs",
        "detail",
        "log-1",
      ]);
      expect(communicationsKeys.templates.all).toEqual(["communications", "templates"]);
      expect(communicationsKeys.templates.list({ page: 1 })).toEqual([
        "communications",
        "templates",
        "list",
        { page: 1 },
      ]);
      expect(communicationsKeys.templates.detail("tmpl-1")).toEqual([
        "communications",
        "templates",
        "detail",
        "tmpl-1",
      ]);
      expect(communicationsKeys.bulk.all).toEqual(["communications", "bulk"]);
      expect(communicationsKeys.bulk.detail("bulk-1")).toEqual([
        "communications",
        "bulk",
        "detail",
        "bulk-1",
      ]);
      expect(communicationsKeys.tasks.detail("task-1")).toEqual([
        "communications",
        "tasks",
        "detail",
        "task-1",
      ]);
      expect(communicationsKeys.stats.overview({})).toEqual([
        "communications",
        "stats",
        "overview",
        {},
      ]);
      expect(communicationsKeys.stats.activity({})).toEqual([
        "communications",
        "stats",
        "activity",
        {},
      ]);
      expect(communicationsKeys.stats.health()).toEqual(["communications", "stats", "health"]);
      expect(communicationsKeys.stats.metrics()).toEqual(["communications", "stats", "metrics"]);
    });
  });

  // ==================== Email Operations ====================

  describe("useSendEmail", () => {
    it("should send email successfully", async () => {
      const mockResponse: SendEmailResponse = {
        message_id: "msg-1",
        status: "sent",
        sent_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.sendEmail as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSendEmail(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const response = await result.current.mutateAsync({
          to: ["test@example.com"],
          subject: "Test Email",
          body: "Test body",
        });
        expect(response).toEqual(mockResponse);
      });

      expect(communicationsService.sendEmail).toHaveBeenCalledWith({
        to: ["test@example.com"],
        subject: "Test Email",
        body: "Test body",
      });
    });

    it("should call onSuccess callback", async () => {
      const mockResponse: SendEmailResponse = {
        message_id: "msg-1",
        status: "sent",
        sent_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.sendEmail as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useSendEmail({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          to: ["test@example.com"],
          subject: "Test",
          body: "Body",
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it("should call onError callback", async () => {
      const error = new Error("Send failed");
      (communicationsService.sendEmail as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useSendEmail({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            to: ["test@example.com"],
            subject: "Test",
            body: "Body",
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should invalidate logs queries on success", async () => {
      const mockResponse: SendEmailResponse = {
        message_id: "msg-1",
        status: "sent",
        sent_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.sendEmail as jest.Mock).mockResolvedValue(mockResponse);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useSendEmail(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          to: ["test@example.com"],
          subject: "Test",
          body: "Body",
        });
      });

      // Verify invalidation was called
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: communicationsKeys.logs.all,
      });
    });
  });

  describe("useQueueEmail", () => {
    it("should queue email successfully", async () => {
      const mockResponse: QueueEmailResponse = {
        task_id: "task-1",
        status: "queued",
        queued_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.queueEmail as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useQueueEmail(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const response = await result.current.mutateAsync({
          to: ["test@example.com"],
          subject: "Test Email",
          body: "Test body",
        });
        expect(response).toEqual(mockResponse);
      });

      expect(communicationsService.queueEmail).toHaveBeenCalledWith({
        to: ["test@example.com"],
        subject: "Test Email",
        body: "Test body",
      });
    });

    it("should call onSuccess callback", async () => {
      const mockResponse: QueueEmailResponse = {
        task_id: "task-1",
        status: "queued",
        queued_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.queueEmail as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useQueueEmail({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          to: ["test@example.com"],
          subject: "Test",
          body: "Body",
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it("should handle queue error", async () => {
      const error = new Error("Queue failed");
      (communicationsService.queueEmail as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useQueueEmail({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            to: ["test@example.com"],
            subject: "Test",
            body: "Body",
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  // ==================== Template Management ====================

  describe("useTemplates", () => {
    it("should fetch templates successfully", async () => {
      const mockTemplates: CommunicationTemplate[] = [
        {
          id: "tmpl-1",
          name: "Welcome Email",
          subject: "Welcome!",
          body_text: "Welcome to our platform",
          channel: "email",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (communicationsService.listTemplates as jest.Mock).mockResolvedValue({
        templates: mockTemplates,
        total: 1,
        page: 1,
        page_size: 50,
      });

      const { result } = renderHook(() => useTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.templates).toEqual(mockTemplates);
      expect(result.current.data?.total).toBe(1);
      expect(communicationsService.listTemplates).toHaveBeenCalledWith({});
    });

    it("should handle filter parameters", async () => {
      (communicationsService.listTemplates as jest.Mock).mockResolvedValue({
        templates: [],
        total: 0,
        page: 1,
        page_size: 10,
      });

      renderHook(
        () =>
          useTemplates({
            channel: "email",
            is_active: true,
            search: "welcome",
            page: 2,
            page_size: 10,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(communicationsService.listTemplates).toHaveBeenCalledWith({
          channel: "email",
          is_active: true,
          search: "welcome",
          page: 2,
          page_size: 10,
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch templates");
      (communicationsService.listTemplates as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useTemplate", () => {
    it("should fetch single template successfully", async () => {
      const mockTemplate: CommunicationTemplate = {
        id: "tmpl-1",
        name: "Welcome Email",
        subject: "Welcome!",
        body_text: "Welcome to our platform",
        channel: "email",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.getTemplate as jest.Mock).mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useTemplate("tmpl-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockTemplate);
      expect(communicationsService.getTemplate).toHaveBeenCalledWith("tmpl-1");
    });

    it("should not fetch when id is null", async () => {
      const { result } = renderHook(() => useTemplate(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(communicationsService.getTemplate).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Template not found");
      (communicationsService.getTemplate as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTemplate("tmpl-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCreateTemplate", () => {
    it("should create template successfully", async () => {
      const mockTemplate: CommunicationTemplate = {
        id: "tmpl-new",
        name: "New Template",
        subject: "Subject",
        body_text: "Body",
        channel: "email",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.createTemplate as jest.Mock).mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useCreateTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const created = await result.current.mutateAsync({
          name: "New Template",
          subject: "Subject",
          body_text: "Body",
          channel: "email",
        });
        expect(created).toEqual(mockTemplate);
      });

      expect(communicationsService.createTemplate).toHaveBeenCalledWith({
        name: "New Template",
        subject: "Subject",
        body_text: "Body",
        channel: "email",
      });
    });

    it("should call onSuccess callback", async () => {
      const mockTemplate: CommunicationTemplate = {
        id: "tmpl-new",
        name: "New Template",
        subject: "Subject",
        body_text: "Body",
        channel: "email",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.createTemplate as jest.Mock).mockResolvedValue(mockTemplate);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useCreateTemplate({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "New Template",
          subject: "Subject",
          body_text: "Body",
          channel: "email",
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockTemplate);
    });

    it("should handle create error", async () => {
      const error = new Error("Create failed");
      (communicationsService.createTemplate as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useCreateTemplate({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            name: "New Template",
            subject: "Subject",
            body_text: "Body",
            channel: "email",
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("useUpdateTemplate", () => {
    it("should update template successfully", async () => {
      const mockTemplate: CommunicationTemplate = {
        id: "tmpl-1",
        name: "Updated Template",
        subject: "Updated Subject",
        body_text: "Body",
        channel: "email",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      (communicationsService.updateTemplate as jest.Mock).mockResolvedValue(mockTemplate);

      const { result } = renderHook(() => useUpdateTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const updated = await result.current.mutateAsync({
          id: "tmpl-1",
          updates: {
            name: "Updated Template",
            subject: "Updated Subject",
          },
        });
        expect(updated).toEqual(mockTemplate);
      });

      expect(communicationsService.updateTemplate).toHaveBeenCalledWith("tmpl-1", {
        name: "Updated Template",
        subject: "Updated Subject",
      });
    });

    it("should call onSuccess callback", async () => {
      const mockTemplate: CommunicationTemplate = {
        id: "tmpl-1",
        name: "Updated Template",
        subject: "Subject",
        body_text: "Body",
        channel: "email",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      (communicationsService.updateTemplate as jest.Mock).mockResolvedValue(mockTemplate);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUpdateTemplate({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "tmpl-1",
          updates: { name: "Updated Template" },
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockTemplate);
    });

    it("should handle update error", async () => {
      const error = new Error("Update failed");
      (communicationsService.updateTemplate as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useUpdateTemplate({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            id: "tmpl-1",
            updates: { name: "Updated" },
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("useDeleteTemplate", () => {
    it("should delete template successfully", async () => {
      (communicationsService.deleteTemplate as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("tmpl-1");
      });

      expect(communicationsService.deleteTemplate).toHaveBeenCalledWith("tmpl-1");
    });

    it("should call onSuccess callback", async () => {
      (communicationsService.deleteTemplate as jest.Mock).mockResolvedValue(undefined);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useDeleteTemplate({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("tmpl-1");
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it("should handle delete error", async () => {
      const error = new Error("Delete failed");
      (communicationsService.deleteTemplate as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useDeleteTemplate({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("tmpl-1");
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("useRenderTemplate", () => {
    it("should render template successfully", async () => {
      const mockResponse: RenderTemplateResponse = {
        subject: "Hello John",
        body_text: "Welcome, John!",
        body_html: "<p>Welcome, John!</p>",
      };

      (communicationsService.renderTemplate as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRenderTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const rendered = await result.current.mutateAsync({
          id: "tmpl-1",
          variables: { name: "John" },
        });
        expect(rendered).toEqual(mockResponse);
      });

      expect(communicationsService.renderTemplate).toHaveBeenCalledWith("tmpl-1", {
        name: "John",
      });
    });

    it("should call onSuccess callback", async () => {
      const mockResponse: RenderTemplateResponse = {
        subject: "Test",
        body_text: "Body",
      };

      (communicationsService.renderTemplate as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRenderTemplate({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "tmpl-1",
          variables: {},
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it("should handle render error", async () => {
      const error = new Error("Render failed");
      (communicationsService.renderTemplate as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useRenderTemplate({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            id: "tmpl-1",
            variables: {},
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("useQuickRender", () => {
    it("should quick render successfully", async () => {
      const mockResponse: RenderTemplateResponse = {
        subject: "Test Subject",
        body_text: "Test Body",
      };

      (communicationsService.quickRender as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useQuickRender(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const rendered = await result.current.mutateAsync({
          subject: "Test {{name}}",
          body_text: "Hello {{name}}",
          variables: { name: "John" },
        });
        expect(rendered).toEqual(mockResponse);
      });

      expect(communicationsService.quickRender).toHaveBeenCalledWith({
        subject: "Test {{name}}",
        body_text: "Hello {{name}}",
        variables: { name: "John" },
      });
    });

    it("should call onSuccess callback", async () => {
      const mockResponse: RenderTemplateResponse = {
        subject: "Test",
        body_text: "Body",
      };

      (communicationsService.quickRender as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useQuickRender({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          subject: "Test",
          body_text: "Body",
          variables: {},
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it("should handle render error", async () => {
      const error = new Error("Render failed");
      (communicationsService.quickRender as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useQuickRender({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            subject: "Test",
            body_text: "Body",
            variables: {},
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  // ==================== Communication Logs ====================

  describe("useCommunicationLogs", () => {
    it("should fetch logs successfully", async () => {
      const mockLogs: CommunicationLog[] = [
        {
          id: "log-1",
          channel: "email",
          status: "sent",
          recipient_email: "test@example.com",
          subject: "Test Email",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      (communicationsService.listLogs as jest.Mock).mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.logs).toEqual(mockLogs);
      expect(result.current.data?.total).toBe(1);
      expect(communicationsService.listLogs).toHaveBeenCalledWith({});
    });

    it("should handle filter parameters", async () => {
      (communicationsService.listLogs as jest.Mock).mockResolvedValue({
        logs: [],
        total: 0,
      });

      renderHook(
        () =>
          useCommunicationLogs({
            channel: "email",
            status: "sent",
            recipient_email: "test@example.com",
            page: 2,
            page_size: 10,
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(communicationsService.listLogs).toHaveBeenCalledWith({
          channel: "email",
          status: "sent",
          recipient_email: "test@example.com",
          page: 2,
          page_size: 10,
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch logs");
      (communicationsService.listLogs as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCommunicationLog", () => {
    it("should fetch single log successfully", async () => {
      const mockLog: CommunicationLog = {
        id: "log-1",
        channel: "email",
        status: "sent",
        recipient_email: "test@example.com",
        subject: "Test Email",
        created_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.getLog as jest.Mock).mockResolvedValue(mockLog);

      const { result } = renderHook(() => useCommunicationLog("log-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockLog);
      expect(communicationsService.getLog).toHaveBeenCalledWith("log-1");
    });

    it("should not fetch when id is null", async () => {
      const { result } = renderHook(() => useCommunicationLog(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(communicationsService.getLog).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Log not found");
      (communicationsService.getLog as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCommunicationLog("log-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Bulk Operations ====================

  describe("useQueueBulk", () => {
    it("should queue bulk operation successfully", async () => {
      const mockBulk: BulkOperation = {
        id: "bulk-1",
        status: "queued",
        total_recipients: 100,
        processed: 0,
        created_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.queueBulkEmail as jest.Mock).mockResolvedValue(mockBulk);

      const { result } = renderHook(() => useQueueBulk(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const bulk = await result.current.mutateAsync({
          template_id: "tmpl-1",
          recipients: ["test1@example.com", "test2@example.com"],
        });
        expect(bulk).toEqual(mockBulk);
      });

      expect(communicationsService.queueBulkEmail).toHaveBeenCalledWith({
        template_id: "tmpl-1",
        recipients: ["test1@example.com", "test2@example.com"],
      });
    });

    it("should call onSuccess callback", async () => {
      const mockBulk: BulkOperation = {
        id: "bulk-1",
        status: "queued",
        total_recipients: 100,
        processed: 0,
        created_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.queueBulkEmail as jest.Mock).mockResolvedValue(mockBulk);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useQueueBulk({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          template_id: "tmpl-1",
          recipients: [],
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockBulk);
    });

    it("should handle queue error", async () => {
      const error = new Error("Queue failed");
      (communicationsService.queueBulkEmail as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useQueueBulk({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            template_id: "tmpl-1",
            recipients: [],
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("useBulkOperationStatus", () => {
    it("should fetch bulk status successfully", async () => {
      const mockStatus: BulkOperationStatusResponse = {
        operation: {
          id: "bulk-1",
          status: "processing",
          total_recipients: 100,
          processed: 50,
          created_at: "2024-01-01T00:00:00Z",
        },
        recent_logs: [],
      };

      (communicationsService.getBulkEmailStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useBulkOperationStatus("bulk-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStatus);
      expect(communicationsService.getBulkEmailStatus).toHaveBeenCalledWith("bulk-1");
    });

    it("should not fetch when id is null", async () => {
      const { result } = renderHook(() => useBulkOperationStatus(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(communicationsService.getBulkEmailStatus).not.toHaveBeenCalled();
    });

    it("should support refetchInterval option", async () => {
      const mockStatus: BulkOperationStatusResponse = {
        operation: {
          id: "bulk-1",
          status: "processing",
          total_recipients: 100,
          processed: 50,
          created_at: "2024-01-01T00:00:00Z",
        },
        recent_logs: [],
      };

      (communicationsService.getBulkEmailStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useBulkOperationStatus("bulk-1", { refetchInterval: 1000 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStatus);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Status not found");
      (communicationsService.getBulkEmailStatus as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useBulkOperationStatus("bulk-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCancelBulk", () => {
    it("should cancel bulk operation successfully", async () => {
      const mockBulk: BulkOperation = {
        id: "bulk-1",
        status: "cancelled",
        total_recipients: 100,
        processed: 50,
        created_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.cancelBulkEmail as jest.Mock).mockResolvedValue(mockBulk);

      const { result } = renderHook(() => useCancelBulk(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const cancelled = await result.current.mutateAsync("bulk-1");
        expect(cancelled).toEqual(mockBulk);
      });

      expect(communicationsService.cancelBulkEmail).toHaveBeenCalledWith("bulk-1");
    });

    it("should call onSuccess callback", async () => {
      const mockBulk: BulkOperation = {
        id: "bulk-1",
        status: "cancelled",
        total_recipients: 100,
        processed: 50,
        created_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.cancelBulkEmail as jest.Mock).mockResolvedValue(mockBulk);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useCancelBulk({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("bulk-1");
      });

      expect(onSuccess).toHaveBeenCalledWith(mockBulk);
    });

    it("should handle cancel error", async () => {
      const error = new Error("Cancel failed");
      (communicationsService.cancelBulkEmail as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useCancelBulk({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("bulk-1");
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  // ==================== Task Monitoring ====================

  describe("useTaskStatus", () => {
    it("should fetch task status successfully", async () => {
      const mockStatus: TaskStatusResponse = {
        task_id: "task-1",
        status: "success",
        result: { message_id: "msg-1" },
      };

      (communicationsService.getTaskStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useTaskStatus("task-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStatus);
      expect(communicationsService.getTaskStatus).toHaveBeenCalledWith("task-1");
    });

    it("should not fetch when taskId is null", async () => {
      const { result } = renderHook(() => useTaskStatus(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(communicationsService.getTaskStatus).not.toHaveBeenCalled();
    });

    it("should support refetchInterval option", async () => {
      const mockStatus: TaskStatusResponse = {
        task_id: "task-1",
        status: "pending",
      };

      (communicationsService.getTaskStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useTaskStatus("task-1", { refetchInterval: 500 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStatus);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Task not found");
      (communicationsService.getTaskStatus as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTaskStatus("task-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Statistics & Analytics ====================

  describe("useCommunicationStats", () => {
    it("should fetch statistics successfully", async () => {
      const mockStats: CommunicationStats = {
        total_sent: 1000,
        total_delivered: 950,
        total_failed: 50,
        total_opened: 500,
        total_clicked: 200,
        delivery_rate: 95,
        open_rate: 50,
        click_rate: 20,
      };

      (communicationsService.getStatistics as jest.Mock).mockResolvedValue(mockStats);

      const { result } = renderHook(() => useCommunicationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(communicationsService.getStatistics).toHaveBeenCalledWith({});
    });

    it("should handle filter parameters", async () => {
      const mockStats: CommunicationStats = {
        total_sent: 100,
        total_delivered: 95,
        total_failed: 5,
        delivery_rate: 95,
      };

      (communicationsService.getStatistics as jest.Mock).mockResolvedValue(mockStats);

      renderHook(
        () =>
          useCommunicationStats({
            date_from: "2024-01-01",
            date_to: "2024-01-31",
            channel: "email",
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(communicationsService.getStatistics).toHaveBeenCalledWith({
          date_from: "2024-01-01",
          date_to: "2024-01-31",
          channel: "email",
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch stats");
      (communicationsService.getStatistics as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCommunicationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCommunicationActivity", () => {
    it("should fetch activity successfully", async () => {
      const mockActivity: ActivityResponse = {
        timeline: [
          {
            date: "2024-01-01",
            sent: 100,
            delivered: 95,
            failed: 5,
          },
        ],
      };

      (communicationsService.getRecentActivity as jest.Mock).mockResolvedValue(mockActivity);

      const { result } = renderHook(() => useCommunicationActivity(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockActivity);
      expect(communicationsService.getRecentActivity).toHaveBeenCalledWith({});
    });

    it("should handle filter parameters", async () => {
      const mockActivity: ActivityResponse = {
        timeline: [],
      };

      (communicationsService.getRecentActivity as jest.Mock).mockResolvedValue(mockActivity);

      renderHook(() => useCommunicationActivity({ days: 30, channel: "email" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(communicationsService.getRecentActivity).toHaveBeenCalledWith({
          days: 30,
          channel: "email",
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch activity");
      (communicationsService.getRecentActivity as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCommunicationActivity(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCommunicationHealth", () => {
    it("should fetch health status successfully", async () => {
      const mockHealth: HealthResponse = {
        smtp_available: true,
        redis_available: true,
        celery_available: true,
        smtp_host: "smtp.example.com",
        smtp_port: 587,
        active_workers: 4,
        pending_tasks: 10,
        failed_tasks: 2,
      };

      (communicationsService.healthCheck as jest.Mock).mockResolvedValue(mockHealth);

      const { result } = renderHook(() => useCommunicationHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockHealth);
      expect(communicationsService.healthCheck).toHaveBeenCalled();
    });

    it("should auto-refresh with refetchInterval", async () => {
      const mockHealth: HealthResponse = {
        smtp_available: true,
        redis_available: true,
        celery_available: true,
        active_workers: 4,
        pending_tasks: 10,
        failed_tasks: 0,
      };

      (communicationsService.healthCheck as jest.Mock).mockResolvedValue(mockHealth);

      const { result } = renderHook(() => useCommunicationHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockHealth);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Health check failed");
      (communicationsService.healthCheck as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCommunicationHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCommunicationMetrics", () => {
    it("should fetch metrics successfully", async () => {
      const mockMetrics: MetricsResponse = {
        total_templates: 50,
        active_templates: 45,
        total_emails_sent: 10000,
        total_emails_delivered: 9500,
        average_delivery_time: 1.5,
      };

      (communicationsService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const { result } = renderHook(() => useCommunicationMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockMetrics);
      expect(communicationsService.getMetrics).toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch metrics");
      (communicationsService.getMetrics as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCommunicationMetrics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Composite Hooks ====================

  describe("useCommunicationsDashboard", () => {
    it("should fetch dashboard data successfully", async () => {
      const mockStats: CommunicationStats = {
        total_sent: 1000,
        total_delivered: 950,
        delivery_rate: 95,
      };

      const mockHealth: HealthResponse = {
        smtp_available: true,
        redis_available: true,
        celery_available: true,
        active_workers: 4,
        pending_tasks: 10,
        failed_tasks: 0,
      };

      const mockLogs: CommunicationLog[] = [
        {
          id: "log-1",
          channel: "email",
          status: "sent",
          recipient_email: "test@example.com",
          subject: "Test",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const mockMetrics: MetricsResponse = {
        total_templates: 50,
        active_templates: 45,
        total_emails_sent: 10000,
        total_emails_delivered: 9500,
        average_delivery_time: 1.5,
      };

      (communicationsService.getStatistics as jest.Mock).mockResolvedValue(mockStats);
      (communicationsService.healthCheck as jest.Mock).mockResolvedValue(mockHealth);
      (communicationsService.listLogs as jest.Mock).mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });
      (communicationsService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const { result } = renderHook(() => useCommunicationsDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.stats).toEqual(mockStats);
      expect(result.current.health).toEqual(mockHealth);
      expect(result.current.recentLogs).toEqual(mockLogs);
      expect(result.current.metrics).toEqual(mockMetrics);
    });

    it("should handle loading state", async () => {
      (communicationsService.getStatistics as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100))
      );
      (communicationsService.healthCheck as jest.Mock).mockResolvedValue({});
      (communicationsService.listLogs as jest.Mock).mockResolvedValue({ logs: [], total: 0 });
      (communicationsService.getMetrics as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useCommunicationsDashboard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });

    it("should handle errors", async () => {
      const error = new Error("Stats failed");
      (communicationsService.getStatistics as jest.Mock).mockRejectedValue(error);
      (communicationsService.healthCheck as jest.Mock).mockResolvedValue({});
      (communicationsService.listLogs as jest.Mock).mockResolvedValue({ logs: [], total: 0 });
      (communicationsService.getMetrics as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useCommunicationsDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useMonitorBulkOperation", () => {
    it("should monitor bulk operation successfully", async () => {
      const mockStatus: BulkOperationStatusResponse = {
        operation: {
          id: "bulk-1",
          status: "processing",
          total_recipients: 100,
          processed: 50,
          created_at: "2024-01-01T00:00:00Z",
        },
        recent_logs: [],
      };

      (communicationsService.getBulkEmailStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useMonitorBulkOperation("bulk-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.operation).toEqual(mockStatus.operation);
      expect(result.current.recentLogs).toEqual([]);
      expect(typeof result.current.cancel).toBe("function");
    });

    it("should cancel bulk operation", async () => {
      const mockStatus: BulkOperationStatusResponse = {
        operation: {
          id: "bulk-1",
          status: "processing",
          total_recipients: 100,
          processed: 50,
          created_at: "2024-01-01T00:00:00Z",
        },
        recent_logs: [],
      };

      const mockCancelled: BulkOperation = {
        id: "bulk-1",
        status: "cancelled",
        total_recipients: 100,
        processed: 50,
        created_at: "2024-01-01T00:00:00Z",
      };

      (communicationsService.getBulkEmailStatus as jest.Mock).mockResolvedValue(mockStatus);
      (communicationsService.cancelBulkEmail as jest.Mock).mockResolvedValue(mockCancelled);

      const { result } = renderHook(() => useMonitorBulkOperation("bulk-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        result.current.cancel();
      });

      await waitFor(() => {
        expect(communicationsService.cancelBulkEmail).toHaveBeenCalledWith("bulk-1");
      });
    });

    it("should not fetch when id is null", async () => {
      const { result } = renderHook(() => useMonitorBulkOperation(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.operation).toBeUndefined();
      expect(communicationsService.getBulkEmailStatus).not.toHaveBeenCalled();
    });
  });

  describe("useMonitorTask", () => {
    it("should monitor task successfully", async () => {
      const mockStatus: TaskStatusResponse = {
        task_id: "task-1",
        status: "success",
        result: { message_id: "msg-1" },
      };

      (communicationsService.getTaskStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useMonitorTask("task-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.task).toEqual(mockStatus);
      expect(result.current.isComplete).toBe(true);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isFailed).toBe(false);
    });

    it("should detect failed tasks", async () => {
      const mockStatus: TaskStatusResponse = {
        task_id: "task-1",
        status: "failure",
        error: "Task failed",
      };

      (communicationsService.getTaskStatus as jest.Mock).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useMonitorTask("task-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isComplete).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isFailed).toBe(true);
    });

    it("should not fetch when taskId is null", async () => {
      const { result } = renderHook(() => useMonitorTask(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.task).toBeUndefined();
      expect(communicationsService.getTaskStatus).not.toHaveBeenCalled();
    });
  });

  describe("useTemplateWithPreview", () => {
    it("should fetch template and preview successfully", async () => {
      const mockTemplate: CommunicationTemplate = {
        id: "tmpl-1",
        name: "Welcome Email",
        subject: "Welcome {{name}}",
        body_text: "Hello {{name}}!",
        channel: "email",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const mockPreview: RenderTemplateResponse = {
        subject: "Welcome John",
        body_text: "Hello John!",
      };

      (communicationsService.getTemplate as jest.Mock).mockResolvedValue(mockTemplate);
      (communicationsService.renderTemplate as jest.Mock).mockResolvedValue(mockPreview);

      const { result } = renderHook(() => useTemplateWithPreview("tmpl-1", { name: "John" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.template).toEqual(mockTemplate);
      expect(typeof result.current.preview).toBe("function");

      await act(async () => {
        const preview = await result.current.preview();
        expect(preview).toEqual(mockPreview);
      });

      expect(communicationsService.renderTemplate).toHaveBeenCalledWith("tmpl-1", {
        name: "John",
      });
    });

    it("should not preview when id is null", async () => {
      const { result } = renderHook(() => useTemplateWithPreview(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.template).toBeUndefined();

      await act(async () => {
        const preview = await result.current.preview();
        expect(preview).toBeUndefined();
      });

      expect(communicationsService.renderTemplate).not.toHaveBeenCalled();
    });

    it("should handle preview error", async () => {
      const mockTemplate: CommunicationTemplate = {
        id: "tmpl-1",
        name: "Template",
        subject: "Subject",
        body_text: "Body",
        channel: "email",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const error = new Error("Render failed");
      (communicationsService.getTemplate as jest.Mock).mockResolvedValue(mockTemplate);
      (communicationsService.renderTemplate as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useTemplateWithPreview("tmpl-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let caughtError;
      await act(async () => {
        try {
          await result.current.preview();
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toEqual(error);

      // Wait for mutation state to update
      await waitFor(() => {
        expect(result.current.previewError).toEqual(error);
      });
    });
  });
});
