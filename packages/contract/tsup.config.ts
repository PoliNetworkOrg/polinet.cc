import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: "es2022",
  // Consumers bring their own copies; never inline them into the bundle.
  external: ["@ts-rest/core", "zod"],
})
