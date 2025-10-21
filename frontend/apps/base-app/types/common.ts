// Common shared types across the application

// Status types
export type Status = "idle" | "loading" | "success" | "error";

// Date/Time utilities
export type DateString = string; // ISO 8601 format
export type Timestamp = number; // Unix timestamp

// ID types for better type safety
export type UUID = string;
export type CustomerID = UUID;
export type InvoiceID = UUID;
export type UserID = UUID;
export type TenantID = UUID;

// Common entity fields
export interface Timestamped {
  createdAt: DateString;
  updatedAt: DateString;
}

export interface SoftDeletable {
  deletedAt?: DateString | null;
  isDeleted?: boolean;
}

export interface Identifiable {
  id: UUID;
}

// Base entity combining common patterns
export interface BaseEntity extends Identifiable, Timestamped {}

// For backward compatibility with snake_case APIs
export interface BaseEntitySnake extends Identifiable {
  created_at: DateString;
  updated_at: DateString;
}

// Metadata pattern
export interface WithMetadata<T = Record<string, unknown>> {
  metadata?: T;
}

// Custom fields pattern
export interface WithCustomFields<T = Record<string, unknown>> {
  custom_fields?: T; // Using snake_case to match API
}

// Tags pattern
export interface WithTags {
  tags?: string[];
}

// Common address structure
export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
}

// Common contact information
export interface ContactInfo {
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
}

// Money/Currency handling
export interface Money {
  amount: number;
  currency: string; // ISO 4217 currency code
  minor_unit?: number;
  minorUnit?: number;
}

// Generic result type for operations
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Form state management
export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
}

// File upload types
export interface FileUpload {
  file: File;
  progress?: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  url?: string;
}

// Notification types
export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  duration?: number;
  timestamp: DateString;
}
