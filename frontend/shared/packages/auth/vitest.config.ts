import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/__tests__/", "**/*.d.ts"],
    },
    // Mock environment variables for testing
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-jwt-secret-for-testing-only",
      JWT_REFRESH_SECRET: "test-refresh-secret-for-testing-only",
      HTTPS: "false",
      CSRF_ENABLED: "true",
      RATE_LIMIT_ENABLED: "true",
      RATE_LIMIT_MAX_ATTEMPTS: "5",
      SESSION_TIMEOUT: "1800000", // 30 minutes
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
