import { z } from "zod";

/**
 * Environment variable validation schemas
 */

// Runtime environment variables (server-side)
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().regex(/^\d+$/).transform(Number).default("3000"),
});

// Build-time environment variables (client-side)
const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:8000"),
  NEXT_PUBLIC_WEBSOCKET_URL: z.string().url().default("ws://localhost:3001"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().min(1),
  NEXT_PUBLIC_OTEL_ENDPOINT: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

// Combined schema for full validation
const envSchema = serverEnvSchema.merge(clientEnvSchema);

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 */
export function validateEnv(): EnvConfig {
  try {
    const validated = envSchema.parse(process.env);

    if (process.env["NODE_ENV"] === "development") {
      console.log("✅ Environment variables validated successfully");
    }

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid environment variables:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });

      // In production, fail fast
      if (process.env["NODE_ENV"] === "production") {
        process.exit(1);
      }
    }
    throw error;
  }
}

/**
 * Get validated environment variable
 */
export function getEnv<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
  const env = validateEnv();
  return env[key];
}

/**
 * Check if all required services are configured
 */
export function checkServiceConfiguration(): {
  valid: boolean;
  missing: string[];
} {
  const required = ["NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_WEBSOCKET_URL"];

  const missing = required.filter((key) => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Environment-specific configuration
 */
export function getEnvironmentConfig() {
  const env = process.env["NODE_ENV"] || "development";

  switch (env) {
    case "production":
      return {
        logLevel: "error",
        enableDebug: false,
        enableSourceMaps: false,
        cacheMaxAge: 31536000, // 1 year
        enableTelemetry: true,
      };
    case "test":
      return {
        logLevel: "warn",
        enableDebug: false,
        enableSourceMaps: true,
        cacheMaxAge: 0,
        enableTelemetry: false,
      };
    case "development":
    default:
      return {
        logLevel: "debug",
        enableDebug: true,
        enableSourceMaps: true,
        cacheMaxAge: 0,
        enableTelemetry: false,
      };
  }
}
