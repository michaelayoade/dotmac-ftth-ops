declare module "@dotmac/primitives" {
  export const validationPatterns: Record<string, RegExp>;
  export const validate: {
    required(value: unknown): boolean;
    oneOf<T>(value: T, options: T[]): boolean;
    [key: string]: (...args: any[]) => boolean;
  };
}
