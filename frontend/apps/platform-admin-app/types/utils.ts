// TypeScript utility types and helpers

// Make all properties optional recursively
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Make all properties required recursively
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

// Make all properties readonly recursively
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Make specific properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Make specific properties required
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Extract keys of a specific type
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

// Nullable type helper
export type Nullable<T> = T | null;

// Maybe type helper (nullable or undefined)
export type Maybe<T> = T | null | undefined;

// Extract the type of array elements
export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

// Extract the return type of a Promise
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

// Create a type from an object's values
export type ValueOf<T> = T[keyof T];

// Ensure at least one property is provided
export type AtLeastOne<T> = {
  [K in keyof T]: Pick<T, K>;
}[keyof T];

// Exclusive OR - only one of the properties can be set
export type XOR<T, U> = (T & { [K in keyof U]?: never }) | (U & { [K in keyof T]?: never });

// Replace a property type in an interface
export type Replace<T, K extends keyof T, V> = Omit<T, K> & { [P in K]: V };

// Get function argument types
export type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;

// String literal union from object keys
export type StringKeys<T> = Extract<keyof T, string>;

// Type guard helpers
export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Assertion functions
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

export function assertDefined<T>(
  value: T | null | undefined,
  message = "Value is not defined",
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

// Branded types for nominal typing
export type Brand<K, T> = K & { __brand: T };

// Example branded types
export type EmailAddress = Brand<string, "EmailAddress">;
export type PositiveNumber = Brand<number, "PositiveNumber">;
export type NonEmptyString = Brand<string, "NonEmptyString">;

// Validators for branded types
export function isValidEmail(value: string): value is EmailAddress {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export function isPositiveNumber(value: number): value is PositiveNumber {
  return value > 0;
}

export function isNonEmptyString(value: string): value is NonEmptyString {
  return value.trim().length > 0;
}
