/**
 * Search Service - API client for global search
 *
 * Provides methods for:
 * - Searching across entities (customers, users, services, etc.)
 * - Advanced filtering and faceting
 * - Search suggestions and autocomplete
 * - Index management
 *
 * This service layer uses types from @/types/search.ts
 * and is designed to work with the Search hooks.
 */

import { platformConfig } from "@/lib/config";
import type {
  SearchResponse,
  SearchParams,
  SearchResult,
  IndexContentRequest,
  IndexContentResponse,
  RemoveFromIndexResponse,
} from "@/types/search";

const API_BASE = platformConfig.api.baseUrl;

// ============================================
// Additional Interfaces
// ============================================

export interface SearchStatistics {
  total_documents: number;
  by_entity_type: Record<string, number>;
  index_size: number;
  last_indexed: string;
}

export interface ReindexRequest {
  entity_type?: string;
  entity_id?: string;
}

// ============================================
// Service Class
// ============================================

class SearchService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE;
  }

  /**
   * Get authentication headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
    };
  }

  /**
   * Handle API errors consistently
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // ============================================
  // Search Operations
  // ============================================

  /**
   * Perform global search
   *
   * @param params - Search parameters
   * @returns Search results
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append("q", params.q);
    if (params.type) searchParams.append("type", params.type);
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.page) searchParams.append("page", params.page.toString());

    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/search?${searchParams.toString()}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<SearchResponse>(response);
  }

  /**
   * Quick search (simpler interface)
   *
   * @param query - Search query
   * @param type - Optional entity type filter
   * @param limit - Number of results
   * @returns Search results
   */
  async quickSearch(query: string, type?: string, limit: number = 10): Promise<SearchResponse> {
    return this.search({
      q: query,
      type,
      limit,
      page: 1,
    });
  }

  /**
   * Search by entity type
   *
   * @param query - Search query
   * @param entityType - Entity type
   * @param limit - Number of results
   * @returns Search results
   */
  async searchByType(
    query: string,
    entityType: string,
    limit: number = 20,
  ): Promise<SearchResponse> {
    return this.search({
      q: query,
      type: entityType,
      limit,
      page: 1,
    });
  }

  // ============================================
  // Index Management
  // ============================================

  /**
   * Index content for search
   *
   * @param content - Content to index
   * @returns Index response
   */
  async indexContent(content: IndexContentRequest): Promise<IndexContentResponse> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/search/index`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(content),
    });

    return this.handleResponse<IndexContentResponse>(response);
  }

  /**
   * Remove content from search index
   *
   * @param contentId - Content ID to remove
   * @returns Remove response
   */
  async removeFromIndex(contentId: string): Promise<RemoveFromIndexResponse> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/search/index/${contentId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<RemoveFromIndexResponse>(response);
  }

  /**
   * Reindex entity
   *
   * @param request - Reindex request
   */
  async reindex(request: ReindexRequest = {}): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/search/reindex`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(request),
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // ============================================
  // Statistics & Health
  // ============================================

  /**
   * Get search statistics
   *
   * @returns Search index statistics
   */
  async getStatistics(): Promise<SearchStatistics> {
    const response = await fetch(`${this.baseUrl}/api/isp/v1/admin/search/stats`, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });

    return this.handleResponse<SearchStatistics>(response);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get entity type color for UI
   *
   * @param entityType - Entity type
   * @returns Color class
   */
  getEntityTypeColor(entityType: string): string {
    const colorMap: Record<string, string> = {
      customer: "bg-blue-100 text-blue-800",
      subscriber: "bg-green-100 text-green-800",
      invoice: "bg-yellow-100 text-yellow-800",
      ticket: "bg-red-100 text-red-800",
      user: "bg-purple-100 text-purple-800",
      device: "bg-indigo-100 text-indigo-800",
      service: "bg-pink-100 text-pink-800",
      order: "bg-orange-100 text-orange-800",
    };
    return colorMap[entityType] || "bg-gray-100 text-gray-800";
  }

  /**
   * Get entity type icon
   *
   * @param entityType - Entity type
   * @returns Icon name
   */
  getEntityTypeIcon(entityType: string): string {
    const iconMap: Record<string, string> = {
      customer: "users",
      subscriber: "user-check",
      invoice: "file-text",
      ticket: "message-square",
      user: "user",
      device: "cpu",
      service: "server",
      order: "shopping-cart",
    };
    return iconMap[entityType] || "search";
  }

  /**
   * Format entity type for display
   *
   * @param entityType - Entity type
   * @returns Formatted string
   */
  formatEntityType(entityType: string): string {
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  }

  /**
   * Get route for entity detail page
   *
   * @param type - Entity type
   * @param id - Entity ID
   * @returns Route path
   */
  getEntityRoute(type: string, id: string): string {
    const routes: Record<string, string> = {
      customer: `/dashboard/customers/${id}`,
      subscriber: `/dashboard/subscribers/${id}`,
      invoice: `/dashboard/billing/invoices/${id}`,
      ticket: `/dashboard/ticketing/tickets/${id}`,
      user: `/dashboard/users/${id}`,
      device: `/dashboard/network/devices/${id}`,
      service: `/dashboard/services/${id}`,
      order: `/dashboard/orders/${id}`,
    };
    return routes[type] || "#";
  }

  /**
   * Highlight search terms in text
   *
   * @param text - Text to highlight
   * @param query - Search query
   * @returns HTML with highlighted terms
   */
  highlightText(text: string, query: string): string {
    if (!query) return text;

    const terms = query.split(/\s+/).filter((t) => t.length > 0);
    let result = text;

    terms.forEach((term) => {
      const regex = new RegExp(`(${term})`, "gi");
      result = result.replace(regex, "<mark>$1</mark>");
    });

    return result;
  }

  /**
   * Format search result for display
   *
   * @param result - Search result
   * @returns Formatted result
   */
  formatResult(result: SearchResult): {
    title: string;
    description: string;
    icon: string;
    color: string;
    route: string;
  } {
    return {
      title: result.title,
      description: result.content,
      icon: this.getEntityTypeIcon(result.type),
      color: this.getEntityTypeColor(result.type),
      route: this.getEntityRoute(result.type, result.id),
    };
  }
}

// Export singleton instance
export const searchService = new SearchService();
