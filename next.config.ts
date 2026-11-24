import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    // SQL files are read at runtime by the server, so they need to be included in the output trace
    "/*": ["./src/sql/**/*.sql"],
  },
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
    // One build worker: the default (one per core) only adds memory at this number of static pages.
    cpus: 1,
  },
}

export default nextConfig
