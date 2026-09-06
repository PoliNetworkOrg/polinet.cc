import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    // Skip @t3-oss/env validation so importing modules doesn't require real
    // secrets/DB config, and so db.ts skips its startup migration side effect.
    env: { SKIP_ENV_VALIDATION: "true" },
  },
})
