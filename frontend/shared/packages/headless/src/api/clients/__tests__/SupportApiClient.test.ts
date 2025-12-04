/**
 * SupportApiClient Tests
 * Comprehensive test suite for support ticket management and knowledge base
 */

import { SupportApiClient } from "../SupportApiClient";
import type {
  SupportTicket,
  TicketComment,
  KnowledgeArticle,
  SupportAgent,
} from "../SupportApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("SupportApiClient", () => {
  let client: SupportApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new SupportApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  const mockErrorResponse = (status: number, message: string) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      statusText: message,
      json: async () => ({
        error: { code: "ERROR", message, details: {} },
      }),
    } as Response);
  };

  describe("Support Tickets Management", () => {
    const mockTicket: SupportTicket = {
      id: "ticket_123",
      ticket_number: "SUP-2024-001",
      customer_id: "cust_123",
      customer_name: "John Doe",
      subject: "Internet connectivity issue",
      description: "Customer experiencing intermittent connectivity issues",
      priority: "HIGH",
      status: "OPEN",
      category: "TECHNICAL",
      assigned_to: "agent_456",
      assigned_team: "Technical Support",
      tags: ["connectivity", "fiber"],
      attachments: [],
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-15T10:30:00Z",
    };

    it("should get tickets with filtering", async () => {
      mockResponse({
        data: [mockTicket],
        pagination: expect.any(Object),
      });

      const result = await client.getTickets({
        status: "OPEN",
        priority: "HIGH",
        assigned_to: "agent_456",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets?status=OPEN&priority=HIGH&assigned_to=agent_456",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining(defaultHeaders),
        }),
      );

      expect(result.data).toContain(mockTicket);
    });

    it("should get single ticket", async () => {
      mockResponse({ data: mockTicket });

      const result = await client.getTicket("ticket_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123",
        expect.any(Object),
      );

      expect(result.data.id).toBe("ticket_123");
    });

    it("should create new ticket", async () => {
      const newTicket = {
        customer_id: "cust_456",
        customer_name: "Jane Smith",
        subject: "Billing inquiry",
        description: "Question about recent charges",
        priority: "MEDIUM" as const,
        category: "BILLING" as const,
        tags: ["billing", "inquiry"],
        attachments: [],
      };

      mockResponse({
        data: { ...newTicket, id: "ticket_456", ticket_number: "SUP-2024-002" },
      });

      const result = await client.createTicket(newTicket);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(newTicket),
        }),
      );

      expect(result.data.subject).toBe("Billing inquiry");
    });

    it("should update ticket", async () => {
      const updates = {
        priority: "URGENT" as const,
        status: "IN_PROGRESS" as const,
      };

      mockResponse({ data: { ...mockTicket, ...updates } });

      const result = await client.updateTicket("ticket_123", updates);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(updates),
        }),
      );

      expect(result.data.priority).toBe("URGENT");
    });

    it("should assign ticket to agent", async () => {
      mockResponse({ data: { ...mockTicket, assigned_to: "agent_789" } });

      const result = await client.assignTicket("ticket_123", "agent_789");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/assign",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ agent_id: "agent_789" }),
        }),
      );

      expect(result.data.assigned_to).toBe("agent_789");
    });

    it("should close ticket with resolution notes", async () => {
      const resolutionNotes = "Issue resolved by replacing network equipment";
      mockResponse({
        data: {
          ...mockTicket,
          status: "RESOLVED",
          resolved_at: "2024-01-16T14:30:00Z",
        },
      });

      const result = await client.closeTicket("ticket_123", resolutionNotes);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/close",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ resolution_notes: resolutionNotes }),
        }),
      );

      expect(result.data.status).toBe("RESOLVED");
    });

    it("should reopen ticket", async () => {
      const reason = "Customer reports issue persists";
      mockResponse({ data: { ...mockTicket, status: "OPEN" } });

      const result = await client.reopenTicket("ticket_123", reason);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/reopen",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason }),
        }),
      );

      expect(result.data.status).toBe("OPEN");
    });
  });

  describe("Ticket Comments Management", () => {
    const mockComment: TicketComment = {
      id: "comment_123",
      ticket_id: "ticket_123",
      author_id: "agent_456",
      author_name: "Support Agent",
      author_type: "AGENT",
      content: "I have reviewed the issue and will escalate to network team",
      internal: false,
      attachments: [],
      created_at: "2024-01-15T11:00:00Z",
    };

    it("should get ticket comments", async () => {
      mockResponse({
        data: [mockComment],
        pagination: expect.any(Object),
      });

      const result = await client.getTicketComments("ticket_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/comments",
        expect.any(Object),
      );

      expect(result.data).toContain(mockComment);
    });

    it("should add ticket comment", async () => {
      const newComment = {
        author_id: "agent_789",
        author_name: "Senior Agent",
        author_type: "AGENT" as const,
        content: "Network diagnostics completed. Issue identified.",
        internal: true,
        attachments: [],
      };

      mockResponse({
        data: { ...newComment, id: "comment_456", ticket_id: "ticket_123" },
      });

      const result = await client.addTicketComment("ticket_123", newComment);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/comments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(newComment),
        }),
      );

      expect(result.data.content).toBe("Network diagnostics completed. Issue identified.");
    });

    it("should update ticket comment", async () => {
      const updatedContent = "Updated: Network diagnostics completed. Resolution in progress.";
      mockResponse({ data: { ...mockComment, content: updatedContent } });

      const result = await client.updateTicketComment("ticket_123", "comment_123", {
        content: updatedContent,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/comments/comment_123",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ content: updatedContent }),
        }),
      );

      expect(result.data.content).toBe(updatedContent);
    });

    it("should delete ticket comment", async () => {
      mockResponse({ success: true });

      const result = await client.deleteTicketComment("ticket_123", "comment_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/comments/comment_123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      expect(result.success).toBe(true);
    });
  });

  describe("File Attachments Management", () => {
    it("should upload attachment to ticket", async () => {
      const mockFile = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      const mockAttachment = {
        id: "att_123",
        filename: "test.pdf",
        file_size: 1024,
        file_type: "application/pdf",
        download_url: "https://api.test.com/files/att_123",
        uploaded_by: "agent_456",
        uploaded_at: "2024-01-15T12:00:00Z",
      };

      mockResponse({ data: mockAttachment });

      const result = await client.uploadAttachment("ticket_123", mockFile);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/attachments",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining(defaultHeaders),
          body: expect.any(FormData),
        }),
      );

      expect(result.data.filename).toBe("test.pdf");
    });

    it("should delete attachment", async () => {
      mockResponse({ success: true });

      const result = await client.deleteAttachment("ticket_123", "att_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/tickets/ticket_123/attachments/att_123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      expect(result.success).toBe(true);
    });

    it("should handle upload errors", async () => {
      const mockFile = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        statusText: "File too large",
      } as Response);

      await expect(client.uploadAttachment("ticket_123", mockFile)).rejects.toThrow(
        "Upload failed: File too large",
      );
    });
  });

  describe("Knowledge Base Management", () => {
    const mockArticle: KnowledgeArticle = {
      id: "kb_123",
      title: "Troubleshooting Internet Connectivity Issues",
      content: "Step-by-step guide for resolving common connectivity problems...",
      category: "Technical Support",
      tags: ["troubleshooting", "connectivity", "network"],
      status: "PUBLISHED",
      author_id: "author_123",
      author_name: "Tech Writer",
      views: 1250,
      helpful_votes: 95,
      total_votes: 108,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-10T15:30:00Z",
      published_at: "2024-01-01T08:00:00Z",
    };

    it("should get knowledge articles", async () => {
      mockResponse({
        data: [mockArticle],
        pagination: expect.any(Object),
      });

      const result = await client.getKnowledgeArticles({
        category: "Technical Support",
        status: "PUBLISHED",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/knowledge?category=Technical%20Support&status=PUBLISHED",
        expect.any(Object),
      );

      expect(result.data).toContain(mockArticle);
    });

    it("should get single knowledge article", async () => {
      mockResponse({ data: mockArticle });

      const result = await client.getKnowledgeArticle("kb_123");

      expect(result.data.id).toBe("kb_123");
    });

    it("should search knowledge articles", async () => {
      mockResponse({
        data: [mockArticle],
        pagination: expect.any(Object),
      });

      const result = await client.searchKnowledge("connectivity issues", {
        category: "Technical Support",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/knowledge/search?q=connectivity%20issues&category=Technical%20Support",
        expect.any(Object),
      );

      expect(result.data).toContain(mockArticle);
    });

    it("should create knowledge article", async () => {
      const newArticle = {
        title: "Setting Up Email on Mobile Devices",
        content: "Complete guide for email configuration...",
        category: "Email Support",
        tags: ["email", "mobile", "setup"],
        status: "DRAFT" as const,
        author_id: "author_456",
        author_name: "Support Specialist",
      };

      mockResponse({ data: { ...newArticle, id: "kb_456" } });

      const result = await client.createKnowledgeArticle(newArticle);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/knowledge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(newArticle),
        }),
      );

      expect(result.data.title).toBe("Setting Up Email on Mobile Devices");
    });

    it("should update knowledge article", async () => {
      const updates = {
        content: "Updated guide with new screenshots...",
        tags: ["email", "mobile", "setup", "updated"],
      };

      mockResponse({ data: { ...mockArticle, ...updates } });

      const result = await client.updateKnowledgeArticle("kb_123", updates);

      expect(result.data.content).toBe("Updated guide with new screenshots...");
    });

    it("should publish knowledge article", async () => {
      mockResponse({
        data: {
          ...mockArticle,
          status: "PUBLISHED",
          published_at: "2024-01-16T10:00:00Z",
        },
      });

      const result = await client.publishKnowledgeArticle("kb_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/knowledge/kb_123/publish",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.data.status).toBe("PUBLISHED");
    });

    it("should vote on knowledge article", async () => {
      mockResponse({
        data: {
          ...mockArticle,
          helpful_votes: 96,
          total_votes: 109,
        },
      });

      const result = await client.voteKnowledgeArticle("kb_123", true);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/knowledge/kb_123/vote",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ helpful: true }),
        }),
      );

      expect(result.data.helpful_votes).toBe(96);
    });
  });

  describe("Support Agents Management", () => {
    const mockAgent: SupportAgent = {
      id: "agent_123",
      name: "Sarah Johnson",
      email: "sarah@company.com",
      status: "AVAILABLE",
      specializations: ["Technical Support", "Network Issues"],
      current_tickets: 5,
      max_tickets: 15,
      response_time_avg: 45, // minutes
      resolution_rate: 92.5, // percentage
    };

    it("should get support agents", async () => {
      mockResponse({
        data: [mockAgent],
        pagination: expect.any(Object),
      });

      const result = await client.getSupportAgents({
        status: "AVAILABLE",
        specialization: "Technical Support",
      });

      expect(result.data).toContain(mockAgent);
    });

    it("should get single support agent", async () => {
      mockResponse({ data: mockAgent });

      const result = await client.getSupportAgent("agent_123");

      expect(result.data.id).toBe("agent_123");
    });

    it("should update agent status", async () => {
      mockResponse({ data: { ...mockAgent, status: "BUSY" } });

      const result = await client.updateAgentStatus("agent_123", "BUSY");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/support/agents/agent_123/status",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "BUSY" }),
        }),
      );

      expect(result.data.status).toBe("BUSY");
    });
  });

  describe("Support Analytics", () => {
    it("should get support metrics", async () => {
      const metrics = {
        total_tickets: 1250,
        open_tickets: 85,
        resolved_tickets: 1100,
        avg_resolution_time: 4.2, // hours
        customer_satisfaction: 4.6, // out of 5
        first_response_time: 23, // minutes
        resolution_rate: 88.0, // percentage
      };

      mockResponse({ data: metrics });

      const result = await client.getSupportMetrics({
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
        agent_id: "agent_123",
      });

      expect(result.data.customer_satisfaction).toBe(4.6);
    });

    it("should get ticket statistics", async () => {
      const stats = {
        tickets_by_priority: {
          LOW: 45,
          MEDIUM: 120,
          HIGH: 85,
          URGENT: 25,
        },
        tickets_by_category: {
          TECHNICAL: 180,
          BILLING: 65,
          GENERAL: 30,
        },
        tickets_by_status: {
          OPEN: 85,
          IN_PROGRESS: 45,
          WAITING_CUSTOMER: 20,
          RESOLVED: 125,
        },
      };

      mockResponse({ data: stats });

      const result = await client.getTicketStats();

      expect(result.data.tickets_by_priority.HIGH).toBe(85);
    });

    it("should get response time statistics", async () => {
      const responseStats = {
        avg_first_response: 25, // minutes
        avg_resolution_time: 4.5, // hours
        response_times_by_priority: {
          LOW: 120,
          MEDIUM: 45,
          HIGH: 15,
          URGENT: 5,
        },
        sla_compliance: 94.2, // percentage
      };

      mockResponse({ data: responseStats });

      const result = await client.getResponseTimeStats({
        period: "last_30_days",
      });

      expect(result.data.sla_compliance).toBe(94.2);
    });
  });

  describe("Error Handling", () => {
    it("should handle ticket not found", async () => {
      mockErrorResponse(404, "Ticket not found");

      await expect(client.getTicket("invalid_ticket")).rejects.toThrow("Ticket not found");
    });

    it("should handle unauthorized access", async () => {
      mockErrorResponse(403, "Insufficient permissions");

      await expect(client.assignTicket("ticket_123", "agent_456")).rejects.toThrow(
        "Insufficient permissions",
      );
    });

    it("should handle validation errors", async () => {
      mockErrorResponse(400, "Invalid priority level");

      await expect(
        client.createTicket({
          customer_id: "cust_123",
          customer_name: "Test Customer",
          subject: "Test Issue",
          description: "Test description",
          priority: "INVALID" as any,
          category: "TECHNICAL",
          tags: [],
          attachments: [],
        }),
      ).rejects.toThrow("Invalid priority level");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getTickets()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Support Workflow Integration", () => {
    it("should handle complete ticket lifecycle", async () => {
      // Create ticket
      const ticketData = {
        customer_id: "cust_123",
        customer_name: "John Doe",
        subject: "Connection Issue",
        description: "Internet not working",
        priority: "HIGH" as const,
        category: "TECHNICAL" as const,
        tags: ["connectivity"],
        attachments: [],
      };

      mockResponse({
        data: {
          ...ticketData,
          id: "ticket_123",
          ticket_number: "SUP-2024-001",
        },
      });
      await client.createTicket(ticketData);

      // Assign to agent
      mockResponse({ data: { id: "ticket_123", assigned_to: "agent_456" } });
      await client.assignTicket("ticket_123", "agent_456");

      // Add comment
      mockResponse({
        data: { id: "comment_123", content: "Investigating issue" },
      });
      await client.addTicketComment("ticket_123", {
        author_id: "agent_456",
        author_name: "Support Agent",
        author_type: "AGENT",
        content: "Investigating issue",
        internal: false,
        attachments: [],
      });

      // Close ticket
      mockResponse({ data: { id: "ticket_123", status: "RESOLVED" } });
      await client.closeTicket("ticket_123", "Issue resolved by modem reset");

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("should handle knowledge base article workflow", async () => {
      // Create draft article
      const articleData = {
        title: "Modem Reset Guide",
        content: "How to reset your modem...",
        category: "Technical Support",
        tags: ["modem", "reset", "troubleshooting"],
        status: "DRAFT" as const,
        author_id: "author_123",
        author_name: "Tech Writer",
      };

      mockResponse({ data: { ...articleData, id: "kb_123" } });
      await client.createKnowledgeArticle(articleData);

      // Update article
      mockResponse({ data: { id: "kb_123", content: "Updated content..." } });
      await client.updateKnowledgeArticle("kb_123", {
        content: "Updated content...",
      });

      // Publish article
      mockResponse({ data: { id: "kb_123", status: "PUBLISHED" } });
      await client.publishKnowledgeArticle("kb_123");

      // Vote on article
      mockResponse({ data: { id: "kb_123", helpful_votes: 1 } });
      await client.voteKnowledgeArticle("kb_123", true);

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });
});
