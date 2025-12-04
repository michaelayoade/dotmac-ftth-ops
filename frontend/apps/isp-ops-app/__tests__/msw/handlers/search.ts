/**
 * MSW Handlers for Search API
 * Mocks global search functionality, index management, and search statistics
 */

import { http, HttpResponse } from "msw";

// In-memory storage
let searchIndex: any[] = [];
let searchContent: Map<string, any> = new Map();
let statistics: any = {
  total_documents: 0,
  by_entity_type: {},
  index_size: 0,
  last_indexed: new Date().toISOString(),
};
let nextContentId = 1;

// Factory functions

/**
 * Create a mock search result
 */
export function createMockSearchResult(data: Partial<any> = {}): any {
  const resultId = data.id || `result-${nextContentId++}`;
  const type = data.type || "subscriber";

  return {
    id: resultId,
    type,
    title: data.title || `Result ${resultId}`,
    content: data.content || `Content for ${resultId}`,
    score: data.score ?? 0.95,
    metadata: data.metadata || {
      entity_id: resultId,
      entity_type: type,
      created_at: new Date().toISOString(),
    },
    ...data,
  };
}

/**
 * Create mock content for indexing
 */
export function createMockContent(data: Partial<any> = {}): any {
  const contentId = data.id || `content-${nextContentId++}`;
  const type = data.entity_type || "subscriber";

  return {
    id: contentId,
    entity_id: data.entity_id || contentId,
    entity_type: type,
    title: data.title || `Content ${contentId}`,
    content: data.content || `Searchable content for ${contentId}`,
    metadata: data.metadata || {},
    indexed_at: data.indexed_at || new Date().toISOString(),
    ...data,
  };
}

/**
 * Create mock search statistics
 */
export function createMockStatistics(data: Partial<any> = {}): any {
  return {
    total_documents: data.total_documents ?? 0,
    by_entity_type: data.by_entity_type || {
      subscriber: 0,
      customer: 0,
      invoice: 0,
      ticket: 0,
      user: 0,
      device: 0,
      service: 0,
      order: 0,
    },
    index_size: data.index_size ?? 0,
    last_indexed: data.last_indexed || new Date().toISOString(),
    ...data,
  };
}

// Seed and reset functions

/**
 * Seed search index with predefined data
 */
export function seedSearchIndex(items: Partial<any>[]): void {
  searchIndex = items.map(createMockSearchResult);

  // Also update content storage
  items.forEach((item) => {
    const content = createMockContent({
      id: item.id,
      entity_id: item.id,
      entity_type: item.type,
      title: item.title,
      content: item.content,
      metadata: item.metadata,
    });
    searchContent.set(content.id, content);
  });

  // Update statistics
  updateStatistics();
}

/**
 * Seed search content for indexing
 */
export function seedSearchContent(items: Partial<any>[]): void {
  items.forEach((item) => {
    const content = createMockContent(item);
    searchContent.set(content.id, content);
  });

  updateStatistics();
}

/**
 * Seed search statistics
 */
export function seedSearchStatistics(stats: Partial<any>): void {
  statistics = createMockStatistics(stats);
}

/**
 * Clear all search data
 */
export function clearSearchData(): void {
  searchIndex = [];
  searchContent.clear();
  statistics = createMockStatistics();
  nextContentId = 1;
}

/**
 * Reset search data to initial state
 */
export function resetSearchData(): void {
  clearSearchData();
}

// Helper functions

/**
 * Update statistics based on current index
 */
function updateStatistics(): void {
  const byEntityType: Record<string, number> = {
    subscriber: 0,
    customer: 0,
    invoice: 0,
    ticket: 0,
    user: 0,
    device: 0,
    service: 0,
    order: 0,
  };

  searchIndex.forEach((item) => {
    if (byEntityType[item.type] !== undefined) {
      byEntityType[item.type]++;
    }
  });

  statistics = {
    total_documents: searchIndex.length,
    by_entity_type: byEntityType,
    index_size: searchIndex.length * 1024, // Mock size calculation
    last_indexed: new Date().toISOString(),
  };
}

/**
 * Perform search with filters
 */
function performSearch(query: string, type?: string, limit: number = 10, page: number = 1): any {
  let results = [...searchIndex];

  // Filter by query
  if (query && query.trim().length > 0) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.content.toLowerCase().includes(lowerQuery),
    );
  }

  // Filter by type
  if (type) {
    results = results.filter((item) => item.type === type);
  }

  // Calculate pagination
  const total = results.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginated = results.slice(start, end);

  // Calculate facets
  const facets = {
    types: {} as Record<string, number>,
  };

  results.forEach((item) => {
    facets.types[item.type] = (facets.types[item.type] || 0) + 1;
  });

  return {
    query,
    results: paginated,
    total,
    page,
    facets,
  };
}

// ============================================
// MSW Handlers
// ============================================

export const searchHandlers = [
  // GET /api/v1/search - Search across tenant entities
  http.get("*/api/v1/search", ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const type = url.searchParams.get("type") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const page = parseInt(url.searchParams.get("page") || "1");

    // Return empty results if query is empty
    if (!query || query.trim().length === 0) {
      return HttpResponse.json({
        query: "",
        results: [],
        total: 0,
        page: 1,
        facets: { types: {} },
      });
    }

    const searchResults = performSearch(query, type, limit, page);
    return HttpResponse.json(searchResults);
  }),

  // POST /api/v1/search/index - Index content for search
  http.post("*/api/v1/search/index", async (req) => {
    const body = await req.json<any>();

    // Create new content
    const content = createMockContent({
      id: body.id,
      entity_id: body.entity_id,
      entity_type: body.entity_type || body.type,
      title: body.title,
      content: body.content,
      metadata: body.metadata,
    });

    // Add to content storage
    searchContent.set(content.id, content);

    // Add to search index
    const searchResult = createMockSearchResult({
      id: content.id,
      type: content.entity_type,
      title: content.title,
      content: content.content,
      metadata: content.metadata,
    });
    searchIndex.push(searchResult);

    // Update statistics
    updateStatistics();

    return HttpResponse.json({
      message: "Content indexed successfully",
      id: content.id,
      indexed: true,
    });
  }),

  // DELETE /api/v1/search/index/:contentId - Remove content from index
  http.delete("*/api/v1/search/index/:contentId", ({ params, request }) => {
    const fallbackId = new URL(request.url).pathname.split("/").pop() ?? "";
    const contentId = (params?.contentId as string | undefined) ?? fallbackId;

    // Try to find and remove from content storage
    const content = searchContent.get(contentId);
    const initialIndexLength = searchIndex.length;

    if (content) {
      searchContent.delete(contentId as string);

      // Remove from search index
      searchIndex = searchIndex.filter(
        (item) => item.id !== contentId && item.id !== content.entity_id,
      );
    } else {
      // Still try to remove from index even if not in content storage
      searchIndex = searchIndex.filter((item) => item.id !== contentId);
    }

    const removed = searchIndex.length < initialIndexLength;

    // Update statistics
    updateStatistics();

    return HttpResponse.json({
      message: removed ? "Content removed from index successfully" : "Content not found",
      id: contentId,
      removed,
    });
  }),

  // POST /api/v1/search/reindex - Reindex entity
  http.post("*/api/v1/search/reindex", async (req) => {
    const body = await req.json<any>();

    // Simulate reindexing
    if (body.entity_type) {
      // Reindex specific entity type
      searchIndex = searchIndex.filter((item) => item.type !== body.entity_type);
    } else if (body.entity_id) {
      // Reindex specific entity
      searchIndex = searchIndex.filter((item) => item.id !== body.entity_id);
    } else {
      // Full reindex - clear and rebuild from content
      searchIndex = [];
    }

    // Rebuild index from content storage
    searchContent.forEach((content) => {
      if (
        (!body.entity_type || content.entity_type === body.entity_type) &&
        (!body.entity_id || content.entity_id === body.entity_id)
      ) {
        const searchResult = createMockSearchResult({
          id: content.entity_id || content.id,
          type: content.entity_type,
          title: content.title,
          content: content.content,
          metadata: content.metadata,
        });
        searchIndex.push(searchResult);
      }
    });

    // Update statistics
    updateStatistics();

    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/v1/search/stats - Get search statistics
  http.get("*/api/v1/search/stats", ({ request }) => {
    return HttpResponse.json(statistics);
  }),
];
