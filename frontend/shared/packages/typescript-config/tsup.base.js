import { defineConfig } from "tsup";

export function createTsupConfig(options) {
  return defineConfig({
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    tsconfig: "tsconfig.json",
    esbuildOptions(esb) {
      esb.target = "es2020";
    },
    ...options,
  });
}
