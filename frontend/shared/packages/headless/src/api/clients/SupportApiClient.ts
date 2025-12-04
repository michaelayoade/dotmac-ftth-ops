/**
 * Support Management API Client
 * Handles support tickets, knowledge base, and customer assistance
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams } from "../types/api";

export interface SupportTicket {
  id: string;
  ticket_number: string;
  customer_id: string;
  customer_name: string;
  subject: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
  category: "TECHNICAL" | "BILLING" | "GENERAL" | "COMPLAINT" | "FEATURE_REQUEST";
  assigned_to?: string;
  assigned_team?: string;
  tags: string[];
  attachments: TicketAttachment[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  author_type: "CUSTOMER" | "AGENT" | "SYSTEM";
  content: string;
  internal: boolean;
  attachments?: TicketAttachment[];
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  filename: string;
  file_size: number;
  file_type: string;
  download_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  author_id: string;
  author_name: string;
  views: number;
  helpful_votes: number;
  total_votes: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
  status: "AVAILABLE" | "BUSY" | "AWAY" | "OFFLINE";
  specializations: string[];
  current_tickets: number;
  max_tickets: number;
  response_time_avg: number;
  resolution_rate: number;
}

export class SupportApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Support Tickets
  async getTickets(params?: QueryParams): Promise<PaginatedResponse<SupportTicket>> {
    return this.get("/api/support/tickets", { params });
  }

  async getTicket(ticketId: string): Promise<{ data: SupportTicket }> {
    return this.get(`/api/support/tickets/${ticketId}`);
  }

  async createTicket(
    data: Omit<SupportTicket, "id" | "ticket_number" | "created_at" | "updated_at">,
  ): Promise<{ data: SupportTicket }> {
    return this.post("/api/support/tickets", data);
  }

  async updateTicket(
    ticketId: string,
    data: Partial<SupportTicket>,
  ): Promise<{ data: SupportTicket }> {
    return this.put(`/api/support/tickets/${ticketId}`, data);
  }

  async assignTicket(ticketId: string, agentId: string): Promise<{ data: SupportTicket }> {
    return this.post(`/api/support/tickets/${ticketId}/assign`, {
      agent_id: agentId,
    });
  }

  async closeTicket(ticketId: string, resolution_notes: string): Promise<{ data: SupportTicket }> {
    return this.post(`/api/support/tickets/${ticketId}/close`, {
      resolution_notes,
    });
  }

  async reopenTicket(ticketId: string, reason: string): Promise<{ data: SupportTicket }> {
    return this.post(`/api/support/tickets/${ticketId}/reopen`, { reason });
  }

  // Ticket Comments
  async getTicketComments(
    ticketId: string,
    params?: QueryParams,
  ): Promise<PaginatedResponse<TicketComment>> {
    return this.get(`/api/support/tickets/${ticketId}/comments`, { params });
  }

  async addTicketComment(
    ticketId: string,
    data: Omit<TicketComment, "id" | "ticket_id" | "created_at">,
  ): Promise<{ data: TicketComment }> {
    return this.post(`/api/support/tickets/${ticketId}/comments`, data);
  }

  async updateTicketComment(
    ticketId: string,
    commentId: string,
    data: { content: string },
  ): Promise<{ data: TicketComment }> {
    return this.put(`/api/support/tickets/${ticketId}/comments/${commentId}`, data);
  }

  async deleteTicketComment(ticketId: string, commentId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/support/tickets/${ticketId}/comments/${commentId}`);
  }

  // File Attachments
  async uploadAttachment(ticketId: string, file: File): Promise<{ data: TicketAttachment }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseURL}/api/support/tickets/${ticketId}/attachments`, {
      method: "POST",
      headers: {
        ...this.defaultHeaders,
        // Don't set Content-Type, let browser set it for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteAttachment(ticketId: string, attachmentId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/support/tickets/${ticketId}/attachments/${attachmentId}`);
  }

  // Knowledge Base
  async getKnowledgeArticles(params?: QueryParams): Promise<PaginatedResponse<KnowledgeArticle>> {
    return this.get("/api/support/knowledge", { params });
  }

  async getKnowledgeArticle(articleId: string): Promise<{ data: KnowledgeArticle }> {
    return this.get(`/api/support/knowledge/${articleId}`);
  }

  async searchKnowledge(
    query: string,
    params?: QueryParams,
  ): Promise<PaginatedResponse<KnowledgeArticle>> {
    return this.get("/api/support/knowledge/search", {
      params: { q: query, ...params },
    });
  }

  async createKnowledgeArticle(
    data: Omit<
      KnowledgeArticle,
      "id" | "views" | "helpful_votes" | "total_votes" | "created_at" | "updated_at"
    >,
  ): Promise<{ data: KnowledgeArticle }> {
    return this.post("/api/support/knowledge", data);
  }

  async updateKnowledgeArticle(
    articleId: string,
    data: Partial<KnowledgeArticle>,
  ): Promise<{ data: KnowledgeArticle }> {
    return this.put(`/api/support/knowledge/${articleId}`, data);
  }

  async publishKnowledgeArticle(articleId: string): Promise<{ data: KnowledgeArticle }> {
    return this.post(`/api/support/knowledge/${articleId}/publish`, {});
  }

  async voteKnowledgeArticle(
    articleId: string,
    helpful: boolean,
  ): Promise<{ data: KnowledgeArticle }> {
    return this.post(`/api/support/knowledge/${articleId}/vote`, { helpful });
  }

  // Support Agents
  async getSupportAgents(params?: QueryParams): Promise<PaginatedResponse<SupportAgent>> {
    return this.get("/api/support/agents", { params });
  }

  async getSupportAgent(agentId: string): Promise<{ data: SupportAgent }> {
    return this.get(`/api/support/agents/${agentId}`);
  }

  async updateAgentStatus(
    agentId: string,
    status: SupportAgent["status"],
  ): Promise<{ data: SupportAgent }> {
    return this.put(`/api/support/agents/${agentId}/status`, { status });
  }

  // Support Analytics
  async getSupportMetrics(params?: {
    start_date?: string;
    end_date?: string;
    agent_id?: string;
  }): Promise<{ data: any }> {
    return this.get("/api/support/metrics", { params });
  }

  async getTicketStats(): Promise<{ data: any }> {
    return this.get("/api/support/tickets/stats");
  }

  async getResponseTimeStats(params?: { period?: string }): Promise<{ data: any }> {
    return this.get("/api/support/response-times", { params });
  }
}
