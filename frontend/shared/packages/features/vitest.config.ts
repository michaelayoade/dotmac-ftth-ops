import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/index.ts",
        "**/*.stories.tsx",
        "**/types.ts",
      ],
      include: ["src/**/*.{ts,tsx}"],
      all: true,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@dotmac/ui": resolve(__dirname, "../ui/src"),
      "@dotmac/testing-utils": resolve(__dirname, "../testing-utils/src"),
    },
  },
});
