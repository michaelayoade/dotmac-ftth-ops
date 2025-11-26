/**
 * Platform Admin App - useTicketing tests
 * Tests for ticketing system hooks with TanStack Query
 */
import {
  useTickets,
  useTicket,
  useCreateTicket,
  useUpdateTicket,
  useAddMessage,
  useTicketStats,
  ticketingKeys,
  TicketSummary,
  TicketDetail,
  TicketMessage,
  TicketStats,
  CreateTicketRequest,
  UpdateTicketRequest,
  AddMessageRequest,
} from "../useTicketing";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { ReactNode } from "react";

// Unmock TanStack Query to use real implementation
jest.unmock("@tanstack/react-query");

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { apiClient } = jest.requireMock("@/lib/api/client");
const { logger } = jest.requireMock("@/lib/logger");

// Test data
const mockTicketMessage: TicketMessage = {
  id: "msg_1",
  ticket_id: "ticket_1",
  sender_type: "platform",
  sender_user_id: "user_1",
  body: "Initial message",
  attachments: [],
  created_at: "2024-01-01T10:00:00Z",
  updated_at: "2024-01-01T10:00:00Z",
};

const mockTicketSummary: TicketSummary = {
  id: "ticket_1",
  ticket_number: "TKT-1001",
  subject: "Connectivity issue",
  status: "open",
  priority: "high",
  origin_type: "customer",
  target_type: "tenant",
  tenant_id: "tenant_1",
  customer_id: "customer_1",
  assigned_to_user_id: "user_1",
  last_response_at: "2024-01-01T10:00:00Z",
  context: { device_id: "device_1" },
  ticket_type: "connectivity_issue",
  service_address: "123 Main St",
  sla_breached: false,
  escalation_level: 0,
  created_at: "2024-01-01T09:00:00Z",
  updated_at: "2024-01-01T10:00:00Z",
};

const mockTicketDetail: TicketDetail = {
  ...mockTicketSummary,
  messages: [mockTicketMessage],
  affected_services: ["service_1"],
  device_serial_numbers: ["SN123456"],
  first_response_at: "2024-01-01T09:30:00Z",
  resolution_time_minutes: 120,
};

const mockTickets: TicketSummary[] = [
  mockTicketSummary,
  {
    ...mockTicketSummary,
    id: "ticket_2",
    ticket_number: "TKT-1002",
    subject: "Billing question",
    status: "in_progress",
    priority: "normal",
    ticket_type: "billing_issue",
    sla_breached: false,
    escalation_level: 0,
  },
  {
    ...mockTicketSummary,
    id: "ticket_3",
    ticket_number: "TKT-1003",
    subject: "Installation request",
    status: "resolved",
    priority: "low",
    ticket_type: "installation_request",
    sla_breached: true,
    escalation_level: 1,
  },
];

const mockTicketMetrics: TicketStats = {
  total: 3,
  open: 1,
  in_progress: 1,
  waiting: 0,
  resolved: 1,
  closed: 0,
  by_priority: {
    low: 1,
    normal: 1,
    high: 1,
    urgent: 0,
  },
  by_type: {
    connectivity_issue: 1,
    billing_issue: 1,
    installation_request: 1,
  },
  sla_breached: 1,
};

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useTicketing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useTickets", () => {
    it("should fetch tickets successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTickets });

      const { result } = renderHook(() => useTickets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tickets).toEqual(mockTickets);
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/tickets", { params: {} });
    });

    it("should fetch tickets with status filter", async () => {
      const openTickets = mockTickets.filter((t) => t.status === "open");
      (apiClient.get as jest.Mock).mockResolvedValue({ data: openTickets });

      const { result } = renderHook(() => useTickets({ status: "open" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tickets).toEqual(openTickets);
      expect(apiClient.get).toHaveBeenCalledWith("/tickets", {
        params: { status: "open" },
      });
    });

    it("should handle fetch errors", async () => {
      const errorMessage = "Failed to fetch tickets";
      (apiClient.get as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useTickets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.tickets).toEqual([]);
      expect(result.current.error).toContain(errorMessage);
    });

    it("should refetch tickets when refetch is called", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTickets });

      const { result } = renderHook(() => useTickets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => expect(result.current.tickets).toEqual([]));
    });
  });

  describe("useTicket", () => {
    it("should fetch single ticket successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTicketDetail });

      const { result } = renderHook(() => useTicket("ticket_1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.ticket).toEqual(mockTicketDetail);
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/tickets/ticket_1");
    });

    it("should not fetch when ticketId is null", async () => {
      const { result } = renderHook(() => useTicket(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.ticket).toBeNull();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch errors", async () => {
      const errorMessage = "Ticket not found";
      (apiClient.get as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useTicket("ticket_1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.ticket).toBeNull();
      expect(result.current.error).toContain(errorMessage);
    });

    it("should refetch ticket when refetch is called", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTicketDetail });

      const { result } = renderHook(() => useTicket("ticket_1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const updatedTicket = { ...mockTicketDetail, status: "closed" as const };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: updatedTicket });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => expect(result.current.ticket?.status).toBe("closed"));
    });
  });

  describe("useCreateTicket", () => {
    it("should create ticket successfully with optimistic update", async () => {
      const newTicketRequest: CreateTicketRequest = {
        subject: "New issue",
        message: "This is a new issue",
        target_type: "tenant",
        priority: "high",
        tenant_id: "tenant_1",
        ticket_type: "technical_support",
        service_address: "456 Oak Ave",
      };

      const createdTicket: TicketDetail = {
        ...mockTicketDetail,
        id: "ticket_new",
        ticket_number: "TKT-1004",
        subject: newTicketRequest.subject,
        priority: newTicketRequest.priority!,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: createdTicket });

      const { result } = renderHook(() => useCreateTicket(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.createTicketAsync(newTicketRequest);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/tickets", newTicketRequest);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        "Creating ticket optimistically",
        expect.objectContaining({
          ticket: expect.objectContaining({
            subject: newTicketRequest.subject,
            priority: newTicketRequest.priority,
          }),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Ticket created",
        expect.objectContaining({ ticket: createdTicket }),
      );
    });

    it("should handle create errors and rollback optimistic update", async () => {
      const newTicketRequest: CreateTicketRequest = {
        subject: "New issue",
        message: "This is a new issue",
        target_type: "tenant",
      };

      const errorMessage = "Failed to create ticket";
      (apiClient.post as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCreateTicket(), {
        wrapper: createWrapper(),
      });

      let caughtError = false;
      await act(async () => {
        try {
          await result.current.createTicketAsync(newTicketRequest);
        } catch (error) {
          caughtError = true;
        }
      });

      expect(caughtError).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create ticket",
        expect.any(Error),
        expect.objectContaining({ targetType: newTicketRequest.target_type }),
      );
    });

    it("should use default priority when not provided", async () => {
      const newTicketRequest: CreateTicketRequest = {
        subject: "New issue",
        message: "This is a new issue",
        target_type: "tenant",
      };

      const createdTicket: TicketDetail = {
        ...mockTicketDetail,
        id: "ticket_new",
        subject: newTicketRequest.subject,
        priority: "normal",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: createdTicket });

      const { result } = renderHook(() => useCreateTicket(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.createTicketAsync(newTicketRequest);
      });

      expect(logger.info).toHaveBeenCalledWith(
        "Creating ticket optimistically",
        expect.objectContaining({
          ticket: expect.objectContaining({
            priority: "normal",
          }),
        }),
      );
    });
  });

  describe("useUpdateTicket", () => {
    it("should update ticket successfully with optimistic update", async () => {
      const updateData: UpdateTicketRequest = {
        status: "in_progress",
        priority: "urgent",
        assigned_to_user_id: "user_2",
      };

      const updatedTicket: TicketDetail = {
        ...mockTicketDetail,
        ...updateData,
      };

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedTicket });

      const { result } = renderHook(() => useUpdateTicket(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.updateTicketAsync("ticket_1", updateData);
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/tickets/ticket_1", updateData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        "Updating ticket optimistically",
        expect.objectContaining({
          ticketId: "ticket_1",
          updates: updateData,
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Ticket updated",
        expect.objectContaining({ ticket: updatedTicket }),
      );
    });

    it("should handle update errors and rollback optimistic update", async () => {
      const updateData: UpdateTicketRequest = {
        status: "resolved",
      };

      const errorMessage = "Failed to update ticket";
      (apiClient.patch as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useUpdateTicket(), {
        wrapper: createWrapper(),
      });

      let caughtError = false;
      await act(async () => {
        try {
          await result.current.updateTicketAsync("ticket_1", updateData);
        } catch (error) {
          caughtError = true;
        }
      });

      expect(caughtError).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update ticket",
        expect.any(Error),
        expect.objectContaining({ ticketId: "ticket_1" }),
      );
    });

    it("should update escalation fields", async () => {
      const updateData: UpdateTicketRequest = {
        escalation_level: 2,
        escalated_to_user_id: "manager_1",
      };

      const updatedTicket: TicketDetail = {
        ...mockTicketDetail,
        escalation_level: 2,
        escalated_to_user_id: "manager_1",
      };

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedTicket });

      const { result } = renderHook(() => useUpdateTicket(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.updateTicketAsync("ticket_1", updateData);
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/tickets/ticket_1", updateData);
      expect(logger.info).toHaveBeenCalledWith(
        "Ticket updated",
        expect.objectContaining({
          ticket: expect.objectContaining({
            escalation_level: 2,
            escalated_to_user_id: "manager_1",
          }),
        }),
      );
    });
  });

  describe("useAddMessage", () => {
    it("should add message successfully with optimistic update", async () => {
      const messageData: AddMessageRequest = {
        message: "Update on the issue",
        attachments: [],
      };

      const newMessage: TicketMessage = {
        id: "msg_2",
        ticket_id: "ticket_1",
        sender_type: "platform",
        body: messageData.message,
        attachments: messageData.attachments || [],
        created_at: "2024-01-01T11:00:00Z",
        updated_at: "2024-01-01T11:00:00Z",
      };

      const updatedTicket: TicketDetail = {
        ...mockTicketDetail,
        messages: [...mockTicketDetail.messages, newMessage],
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: updatedTicket });

      const { result } = renderHook(() => useAddMessage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.addMessageAsync("ticket_1", messageData);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/tickets/ticket_1/messages", messageData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        "Adding message optimistically",
        expect.objectContaining({
          ticketId: "ticket_1",
          message: expect.objectContaining({
            body: messageData.message,
          }),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Message added to ticket",
        expect.objectContaining({ ticketId: "ticket_1" }),
      );
    });

    it("should add message with status change", async () => {
      const messageData: AddMessageRequest = {
        message: "Issue resolved",
        new_status: "resolved",
      };

      const updatedTicket: TicketDetail = {
        ...mockTicketDetail,
        status: "resolved",
        messages: [
          ...mockTicketDetail.messages,
          {
            id: "msg_2",
            ticket_id: "ticket_1",
            sender_type: "platform",
            body: messageData.message,
            attachments: [],
            created_at: "2024-01-01T11:00:00Z",
            updated_at: "2024-01-01T11:00:00Z",
          },
        ],
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: updatedTicket });

      const { result } = renderHook(() => useAddMessage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.addMessageAsync("ticket_1", messageData);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/tickets/ticket_1/messages", messageData);
    });

    it("should handle add message errors and rollback optimistic update", async () => {
      const messageData: AddMessageRequest = {
        message: "This will fail",
      };

      const errorMessage = "Failed to add message";
      (apiClient.post as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAddMessage(), {
        wrapper: createWrapper(),
      });

      let caughtError = false;
      await act(async () => {
        try {
          await result.current.addMessageAsync("ticket_1", messageData);
        } catch (error) {
          caughtError = true;
        }
      });

      expect(caughtError).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to add ticket message",
        expect.any(Error),
        expect.objectContaining({ ticketId: "ticket_1" }),
      );
    });
  });

  describe("useTicketStats", () => {
    it("should fetch metrics from the API", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTicketMetrics });

      const { result } = renderHook(() => useTicketStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats).toEqual({
        ...mockTicketMetrics,
        avg_resolution_time_minutes: undefined,
      });
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/tickets/metrics");
    });

    it("should handle missing fields by returning zeroed defaults", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useTicketStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats).toEqual({
        total: 0,
        open: 0,
        in_progress: 0,
        waiting: 0,
        resolved: 0,
        closed: 0,
        by_priority: {
          low: 0,
          normal: 0,
          high: 0,
          urgent: 0,
        },
        by_type: {},
        sla_breached: 0,
        avg_resolution_time_minutes: undefined,
      });
    });

    it("should handle fetch errors", async () => {
      const errorMessage = "Failed to fetch stats";
      (apiClient.get as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useTicketStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.stats).toBeNull();
      expect(result.current.error).toContain(errorMessage);
    });

    it("should refetch stats when refetch is called", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTicketMetrics });

      const { result } = renderHook(() => useTicketStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const updatedMetrics = { ...mockTicketMetrics, total: 2, open: 0 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: updatedMetrics });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => expect(result.current.stats?.total).toBe(2));
    });
  });

  describe("ticketingKeys", () => {
    it("should generate correct query keys", () => {
      expect(ticketingKeys.all).toEqual(["ticketing"]);
      expect(ticketingKeys.lists()).toEqual(["ticketing", "list"]);
      expect(ticketingKeys.list({ status: "open" })).toEqual([
        "ticketing",
        "list",
        { status: "open" },
      ]);
      expect(ticketingKeys.details()).toEqual(["ticketing", "detail"]);
      expect(ticketingKeys.detail("ticket_1")).toEqual(["ticketing", "detail", "ticket_1"]);
      expect(ticketingKeys.stats()).toEqual(["ticketing", "stats"]);
    });
  });

  describe("integration scenarios", () => {
    it("should handle create and fetch in sequence", async () => {
      const newTicketRequest: CreateTicketRequest = {
        subject: "New issue",
        message: "This is a new issue",
        target_type: "tenant",
      };

      const createdTicket: TicketDetail = {
        ...mockTicketDetail,
        id: "ticket_new",
        subject: newTicketRequest.subject,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: createdTicket });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: createdTicket });

      const testWrapper = createWrapper();
      const { result: createResult } = renderHook(() => useCreateTicket(), {
        wrapper: testWrapper,
      });

      await act(async () => {
        await createResult.current.createTicketAsync(newTicketRequest);
      });

      const { result: fetchResult } = renderHook(() => useTicket("ticket_new"), {
        wrapper: testWrapper,
      });

      await waitFor(() => expect(fetchResult.current.ticket).toBeTruthy());
      expect(fetchResult.current.ticket?.subject).toBe(newTicketRequest.subject);
    });

    it("should handle update and refetch in sequence", async () => {
      const updateData: UpdateTicketRequest = {
        status: "resolved",
      };

      const updatedTicket: TicketDetail = {
        ...mockTicketDetail,
        status: "resolved",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTicketDetail });
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedTicket });

      const testWrapper = createWrapper();
      const { result: fetchResult } = renderHook(() => useTicket("ticket_1"), {
        wrapper: testWrapper,
      });

      await waitFor(() => expect(fetchResult.current.ticket).toBeTruthy());
      expect(fetchResult.current.ticket?.status).toBe("open");

      const { result: updateResult } = renderHook(() => useUpdateTicket(), {
        wrapper: testWrapper,
      });

      (apiClient.get as jest.Mock).mockResolvedValue({ data: updatedTicket });

      await act(async () => {
        await updateResult.current.updateTicketAsync("ticket_1", updateData);
      });

      await act(async () => {
        await fetchResult.current.refetch();
      });

      await waitFor(() => expect(fetchResult.current.ticket?.status).toBe("resolved"));
    });
  });
});
