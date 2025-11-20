/**
 * Shared API utilities for building URLs and handling responses
 */

import { z } from 'zod';

export interface ApiConfig {
  baseUrl?: string;
  prefix?: string;
  buildUrl?: (path: string) => string;
}

/**
 * Builds a full API URL from a path using the provided API configuration
 * @param path - The API path (e.g., "/radius/subscribers")
 * @param api - The API configuration object
 * @returns The full URL
 */
export function buildApiUrl(path: string, api: ApiConfig): string {
  // If api.buildUrl function exists, use it
  if (typeof api.buildUrl === 'function') {
    return api.buildUrl(path);
  }

  // Otherwise, construct URL manually
  const base = api.baseUrl || '';
  const prefix = api.prefix || '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${prefix}${normalizedPath}`;
}

export interface ListResponse<T> {
  data: T[];
  total: number;
}

/**
 * Parses a list response from various API response formats
 * Handles multiple response structures and extracts total count from various sources
 *
 * @param response - The fetch Response object
 * @param schema - Optional Zod schema for validating items
 * @returns Promise containing the parsed data and total count
 */
export async function parseListResponse<T>(
  response: Response,
  schema?: z.ZodSchema<T>
): Promise<ListResponse<T>> {
  const payload = await response.json();
  let items: T[] = [];
  let total = 0;

  // Handle different response formats
  if (Array.isArray(payload)) {
    items = payload;
  } else if (Array.isArray(payload?.data)) {
    items = payload.data;
    total = Number(payload?.total ?? payload?.count ?? payload?.total_count ?? items.length);
  } else if (Array.isArray(payload?.items)) {
    items = payload.items;
    total = Number(payload?.total ?? payload?.count ?? payload?.total_count ?? items.length);
  } else {
    items = [];
  }

  // Validate items if schema provided
  if (schema) {
    try {
      items = items.map((item) => schema.parse(item));
    } catch (error) {
      throw new Error(
        `API response validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Try to get total from response headers if not valid
  if (!Number.isFinite(total) || total <= 0) {
    const headerTotal =
      response.headers.get('x-total-count') ||
      response.headers.get('x-total') ||
      response.headers.get('x-total-results');
    if (headerTotal) {
      const parsed = Number.parseInt(headerTotal, 10);
      if (Number.isFinite(parsed)) {
        total = parsed;
      }
    }
  }

  // Fallback to items length
  if (!Number.isFinite(total) || total <= 0) {
    total = items.length;
  }

  return { data: items, total };
}

/**
 * Enhanced error handling for API requests
 * Extracts detailed error information from response body
 *
 * @param response - The fetch Response object
 * @param defaultMessage - Default error message
 * @returns Promise that rejects with a detailed error
 */
export async function handleApiError(
  response: Response,
  defaultMessage: string
): Promise<never> {
  let errorDetails = response.statusText;

  try {
    const errorBody = await response.json();
    if (errorBody?.message) {
      errorDetails = errorBody.message;
    } else if (errorBody?.error) {
      errorDetails = typeof errorBody.error === 'string'
        ? errorBody.error
        : JSON.stringify(errorBody.error);
    } else if (errorBody?.detail) {
      errorDetails = errorBody.detail;
    }
  } catch {
    // If we can't parse JSON, use statusText
  }

  throw new Error(`${defaultMessage}: ${errorDetails}`);
}
