/**
 * Global Search Types
 *
 * Type definitions for the global search functionality across all tenant entities.
 */

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  page: number;
  facets: {
    types: Record<string, number>;
  };
}

export interface SearchParams {
  q: string;
  type?: string | undefined;
  limit?: number | undefined;
  page?: number | undefined;
}

export interface IndexContentRequest {
  [key: string]: any;
}

export interface IndexContentResponse {
  message: string;
  id: string;
}

export interface RemoveFromIndexResponse {
  message: string;
}

// Entity type constants for filtering
export const SEARCH_ENTITY_TYPES = {
  CUSTOMER: "customer",
  SUBSCRIBER: "subscriber",
  INVOICE: "invoice",
  TICKET: "ticket",
  USER: "user",
  DEVICE: "device",
  SERVICE: "service",
  ORDER: "order",
} as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[keyof typeof SEARCH_ENTITY_TYPES];

// Type badge colors
export const TYPE_COLORS: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800",
  subscriber: "bg-green-100 text-green-800",
  invoice: "bg-yellow-100 text-yellow-800",
  ticket: "bg-red-100 text-red-800",
  user: "bg-purple-100 text-purple-800",
  device: "bg-indigo-100 text-indigo-800",
  service: "bg-pink-100 text-pink-800",
  order: "bg-orange-100 text-orange-800",
  unknown: "bg-gray-100 text-gray-800",
};

// Helper to get route for entity detail page
export function getEntityRoute(type: string, id: string): string {
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

// Format entity type for display
export function formatEntityType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
