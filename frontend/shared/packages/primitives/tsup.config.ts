import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: false,
  external: ["react", "react-dom", "react-window", "@dotmac/primitives"],
  clean: true,
  skipNodeModulesBundle: true,
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
