import bundleAnalyzer from "@next/bundle-analyzer"
import type { NextConfig } from "next"

const ANALYZE_AND_PROFILE = !!process.env.ANALYZE
const withBundleAnalyzer = bundleAnalyzer({ enabled: ANALYZE_AND_PROFILE })

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  experimental: { swcTraceProfiling: ANALYZE_AND_PROFILE },
}

export default withBundleAnalyzer(nextConfig)
