import { NextResponse } from "next/server"
import { env } from "@/env"
import { analyticsService } from "@/lib/analytics-service"

// Guarantees the daily-unique-click dedup retention window regardless of
// traffic: recordClickSafely() also purges opportunistically on ~2% of
// clicks, but a link that stops being clicked would otherwise never get
// purged again. Call this on a schedule (see
// .github/workflows/purge-analytics-dedup.yml).
export async function GET(request: Request) {
  if (env.CRON_SECRET) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const deleted = await analyticsService.purgeExpiredDedup()
  return NextResponse.json({ deleted })
}
