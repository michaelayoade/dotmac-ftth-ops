// API Response types with proper generics
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface ResponseMetadata {
  timestamp: string;
  requestId?: string;
  version?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiListResponse<T> extends ApiResponse<PaginatedResponse<T>> {}

// Request types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, unknown>;
}

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}

// Error handling utilities
export type ApiErrorHandler = (error: ApiError) => void;

export interface ApiRequestOptions {
  signal?: AbortSignal;
  onUploadProgress?: (progressEvent: ProgressEvent) => void;
  onDownloadProgress?: (progressEvent: ProgressEvent) => void;
}

// Type guards
export function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

export function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return typeof response === "object" && response !== null && "success" in response;
}
