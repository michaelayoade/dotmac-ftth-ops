/**
 * Audit API Client
 * Provides comprehensive audit logging integration with backend audit system
 */

import { BaseApiClient } from "./BaseApiClient";
import type { RequestConfig } from "./BaseApiClient";
import type {
  AuditEvent,
  AuditEventQuery,
  AuditEventResponse,
  AuditHealthResponse,
} from "../types/audit";

export class AuditApiClient extends BaseApiClient {
  constructor(baseURL: string, headers: Record<string, string> = {}) {
    super(baseURL, headers, "AuditAPI");
  }

  /**
   * Log an audit event to the backend
   */
  async logEvent(event: Omit<AuditEvent, "event_id" | "timestamp">): Promise<{ event_id: string }> {
    return this.post<{ event_id: string }>("/audit/events", event);
  }

  /**
   * Log multiple audit events in a batch
   */
  async logEventsBatch(
    events: Omit<AuditEvent, "event_id" | "timestamp">[],
  ): Promise<{ event_ids: string[] }> {
    return this.post<{ event_ids: string[] }>("/audit/events/batch", {
      events,
    });
  }

  /**
   * Query audit events with filtering
   */
  async queryEvents(query: AuditEventQuery = {}): Promise<AuditEventResponse> {
    const config: RequestConfig = { params: query };
    return this.get<AuditEventResponse>("/audit/events", config);
  }

  /**
   * Stream audit events (Server-Sent Events)
   */
  async streamEvents(query: AuditEventQuery = {}): Promise<EventSource> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });

    const url = `${this.baseURL}/audit/events/stream?${params.toString()}`;
    return new EventSource(url);
  }

  /**
   * Export audit events
   */
  async exportEvents(format: "json" | "csv", query: AuditEventQuery = {}): Promise<Blob> {
    const config: RequestConfig = {
      params: { ...query, format },
      headers: { Accept: format === "csv" ? "text/csv" : "application/json" },
    };
    return this.get<Blob>("/audit/events/export", config);
  }

  /**
   * Get audit system health
   */
  async getHealth(): Promise<AuditHealthResponse> {
    return this.get<AuditHealthResponse>("/audit/health");
  }

  /**
   * Get audit metrics
   */
  async getMetrics(): Promise<Record<string, any>> {
    return this.get<Record<string, any>>("/audit/metrics");
  }

  /**
   * Get compliance report
   */
  async getComplianceReport(framework?: string): Promise<Record<string, any>> {
    const config: RequestConfig = framework ? { params: { framework } } : {};
    return this.get<Record<string, any>>("/audit/compliance/report", config);
  }
}
