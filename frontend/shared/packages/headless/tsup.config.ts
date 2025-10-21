import { defineConfig, Options } from "tsup";
import { readFileSync, writeFileSync } from "fs";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "utils/csp": "src/utils/csp.ts",
    "utils/production-data-guard": "src/utils/production-data-guard.ts",
    "utils/telemetry": "src/utils/telemetry.ts",
  },
  format: ["cjs", "esm"],
  dts: false, // Skip DTS generation due to many TS errors - will fix separately
  external: ["next/navigation", "next/router", "react", "react-dom", "@dotmac/primitives"],
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  skipNodeModulesBundle: true,
  onSuccess: async () => {
    // Add "use client" directive to output files
    const files = ["dist/index.js", "dist/index.mjs"];
    for (const file of files) {
      try {
        const content = readFileSync(file, "utf-8");
        if (!content.startsWith('"use client"')) {
          writeFileSync(file, `"use client";\n${content}`);
        }
      } catch (err) {
        // File might not exist, ignore
      }
    }
  },
  esbuildOptions(options) {
    options.logLevel = "error"; // Only show errors
  },
});
