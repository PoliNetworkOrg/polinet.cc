import bundleAnalyzer from "@next/bundle-analyzer"
import type { NextConfig } from "next"

const ANALYZE_AND_PROFILE = !!process.env.ANALYZE
const withBundleAnalyzer = bundleAnalyzer({ enabled: ANALYZE_AND_PROFILE })

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  outputFileTracingIncludes: {
    // SQL files are read at runtime by the server, so they need to be included in the output trace
    "/src/sql": ["./src/sql/**/*.sql"],
  },
  experimental: { reactCompiler: true, swcTraceProfiling: ANALYZE_AND_PROFILE },
}

export default withBundleAnalyzer(nextConfig)
