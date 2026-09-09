import { headers } from "next/headers"
import { notFound, RedirectType, redirect } from "next/navigation"
import { after } from "next/server"
import { env } from "@/env"
import { analyticsService } from "@/lib/analytics-service"
import { getCountryFromHeaders } from "@/lib/geo"
import { urlService } from "@/lib/url-service"

interface Props {
  params: Promise<{
    shortCode: string
  }>
}

// IP headers written by the trusted edge/CDN in front of the app, which
// overwrite any client-supplied copy — unlike generic `X-Forwarded-For`/
// `X-Real-IP`, which a visitor can set arbitrarily on a direct request. If you
// run behind a different trusted proxy, name its header via TRUSTED_IP_HEADER.
const TRUSTED_EDGE_IP_HEADERS = [
  "cf-connecting-ip", // Cloudflare
  "x-vercel-forwarded-for", // Vercel
]

/** Real client IP from a trusted edge header only. Used transiently only. */
function extractIp(h: Headers): string {
  const candidates = env.TRUSTED_IP_HEADER
    ? [env.TRUSTED_IP_HEADER]
    : TRUSTED_EDGE_IP_HEADERS

  for (const name of candidates) {
    const value = h.get(name)?.trim()
    if (value) return value
  }
  return ""
}

export default async function RedirectPage({ params }: Props) {
  const { shortCode } = await params

  const urlRecord = await urlService.getUrlByShortCode(shortCode)
  if (!urlRecord) {
    notFound()
  }

  // Read request metadata transiently. The IP and User-Agent live only inside
  // this request scope: they are handed to the analytics recorder to derive a
  // country + a daily hash, then discarded. They are never persisted or logged.
  const h = await headers()
  const ip = extractIp(h)
  const userAgent = h.get("user-agent") ?? ""
  const country = getCountryFromHeaders(h)

  // Keep the redirect fast and resilient: analytics run after the response and
  // a failure here must never break the redirect. Errors are logged generically
  // (no IP/User-Agent) to avoid leaking sensitive transient data.
  after(async () => {
    await urlService
      .incrementClickCount(shortCode)
      .catch(() => console.error("Failed to increment click count"))
    // recordClickSafely never throws — a failure here must not break redirects.
    await analyticsService.recordClickSafely({
      urlId: urlRecord.id,
      ip,
      userAgent,
      country,
    })
  })

  redirect(urlRecord.original_url, RedirectType.push)
}
