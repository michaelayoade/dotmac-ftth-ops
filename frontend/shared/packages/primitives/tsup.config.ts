import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: false, // Manual .d.ts file used due to test prop type errors
  external: ["react", "react-dom", "react-window", "@dotmac/primitives"],
  clean: false, // Don't clean to preserve manual .d.ts
  skipNodeModulesBundle: true,
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
