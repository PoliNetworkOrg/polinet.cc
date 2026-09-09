import { createHmac } from "node:crypto"
import type { Pool } from "pg"
import { env } from "@/env"
import { getPool } from "./db"
import { UNKNOWN_COUNTRY } from "./geo"
import {
  AnalyticsResult,
  type AnalyticsResult as AnalyticsResultType,
} from "./schemas"

// Deduplication rows only need to survive for same-day dedup. We keep today and
// yesterday (≈24–48h) as a small buffer around the UTC day boundary, then purge.
export const DEDUP_RETENTION_DAYS = 1

// Fraction of recorded clicks that also trigger an (idempotent) dedup purge.
const PURGE_PROBABILITY = 0.02

// ── Pure, side-effect-free helpers (unit-testable without a database) ─────────

/** UTC calendar date as `YYYY-MM-DD`. The dedup hash rotates on this value. */
export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Truncate to the start of the UTC hour. */
export function hourBucket(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours()
    )
  )
}

/** Truncate to the start of the UTC day. */
export function dayBucket(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Truncate to the start of the UTC month. */
export function monthBucket(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

/** Keep only a valid ISO alpha-2 code, otherwise report as Unknown. */
export function normalizeCountry(country: string | null | undefined): string {
  if (!country) return UNKNOWN_COUNTRY
  const code = country.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : UNKNOWN_COUNTRY
}

/**
 * Derive the daily, per-link visitor hash used to estimate unique clicks
 * WITHOUT cookies or fingerprinting.
 *
 * Privacy properties:
 *  - HMAC-SHA256 keyed with a server-side secret → not reversible/guessable.
 *  - `dateStr` is part of the message, so the hash ROTATES every UTC day. The
 *    same visitor produces a different hash tomorrow → no cross-day tracking.
 *  - `urlId` binds the hash to a single link → reduces linkability across
 *    different links.
 *  - The raw IP and User-Agent are inputs only; they are never returned or
 *    stored. Only this digest may be persisted, and only transiently.
 */
export function computeDailyVisitorHash(
  secret: string,
  input: { urlId: number; dateStr: string; ip: string; userAgent: string }
): string {
  return createHmac("sha256", secret)
    .update(`${input.urlId}|${input.dateStr}|${input.ip}|${input.userAgent}`)
    .digest("hex")
}

/** True for a Postgres unique-constraint violation (SQLSTATE 23505). */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "23505"
  )
}

interface BucketRow {
  bucket_type: string
  bucket_start: Date
  clicks_count: number
  unique_estimated_count: number
}

interface CountryRow {
  country_code: string
  clicks: number
}

export interface RecordClickInput {
  urlId: number
  /** Transient. Used only to derive the hash + country, never stored. */
  ip: string
  /** Transient. Used only to derive the hash, never stored. */
  userAgent: string
  /** Country code or "Unknown". */
  country: string
  /** Injectable clock for tests. */
  at?: Date
}

export class AnalyticsService {
  private pool: Pool
  private secret: string

  constructor(opts?: { pool?: Pool; secret?: string }) {
    this.pool = opts?.pool ?? getPool()
    this.secret = opts?.secret ?? env.ANALYTICS_HASH_SECRET
  }

  /**
   * Record a single click into the aggregated analytics tables.
   *
   * The IP and User-Agent arrive only as function arguments, are consumed to
   * derive the country + daily hash, and go out of scope when this returns.
   * They are NEVER written to any table, log, or error message.
   */
  async recordClick(input: RecordClickInput): Promise<void> {
    const now = input.at ?? new Date()
    const dateStr = utcDateString(now)
    const country = normalizeCountry(input.country)

    const buckets = [
      ["hour", hourBucket(now)],
      ["day", dayBucket(now)],
      ["month", monthBucket(now)],
    ] as const

    // Derive the (non-reversible) daily hash. After this the raw ip/userAgent
    // are not referenced by anything we persist.
    const hash = computeDailyVisitorHash(this.secret, {
      urlId: input.urlId,
      dateStr,
      ip: input.ip,
      userAgent: input.userAgent,
    })

    // First sighting of this visitor today → count a unique. This insert is
    // deliberately its OWN statement, outside the transaction below: the
    // table's unique constraint is the sole arbiter of "first sighting", via
    // a plain INSERT (no ON CONFLICT) whose success/failure we observe
    // directly. Two concurrent clicks from the same visitor race at the DB
    // level on this single row — exactly one INSERT can ever succeed — so,
    // unlike a check-then-insert (SELECT then conditionally INSERT), there is
    // no window where both racers see "not present" and both count a unique.
    // (A single INSERT ... ON CONFLICT DO NOTHING, deciding uniqueness from
    // its rowCount/RETURNING, would be one round trip instead of two, but is
    // deliberately avoided: some pg-compatible engines misreport rowCount/
    // RETURNING for a no-op ON CONFLICT DO NOTHING, silently breaking dedup.)
    let uniqueDelta = 0
    try {
      await this.pool.query(
        `INSERT INTO daily_unique_click_dedup
           (url_id, bucket_date, daily_visitor_hash)
         VALUES ($1, $2, $3)`,
        [input.urlId, dateStr, hash]
      )
      uniqueDelta = 1
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      uniqueDelta = 0
    }

    // The bucket/country aggregate increments run in their own transaction —
    // they always happen (every click counts toward clicks_count), using the
    // uniqueDelta already decided above.
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")

      for (const [type, start] of buckets) {
        await client.query(
          `INSERT INTO click_analytics_buckets
             (url_id, bucket_type, bucket_start, clicks_count, unique_estimated_count)
           VALUES ($1, $2, $3, 1, $4)
           ON CONFLICT (url_id, bucket_type, bucket_start)
           DO UPDATE SET
             clicks_count = click_analytics_buckets.clicks_count + 1,
             unique_estimated_count =
               click_analytics_buckets.unique_estimated_count + $4,
             updated_at = CURRENT_TIMESTAMP`,
          [input.urlId, type, start, uniqueDelta]
        )
      }

      await client.query(
        `INSERT INTO click_country_analytics
           (url_id, bucket_date, country_code, clicks_count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (url_id, bucket_date, country_code)
         DO UPDATE SET
           clicks_count = click_country_analytics.clicks_count + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [input.urlId, dateStr, country]
      )

      await client.query("COMMIT")
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  }

  /**
   * Record a click but never throw — analytics must not break the redirect.
   * On failure it logs a generic, non-sensitive message (no IP/UA) and returns
   * false. Returns true when the click was recorded.
   */
  async recordClickSafely(input: RecordClickInput): Promise<boolean> {
    try {
      await this.recordClick(input)
      // Opportunistic, traffic-driven cleanup. Runs on a small fraction of
      // clicks so retention holds on serverless runtimes (where a long-lived
      // timer would never fire) without adding a write to every request.
      if (Math.random() < PURGE_PROBABILITY) {
        await this.purgeExpiredDedup().catch(() => {
          console.error("Analytics dedup purge failed")
        })
      }
      return true
    } catch {
      console.error("Failed to record click analytics")
      return false
    }
  }

  /** Delete deduplication rows older than the retention window. */
  async purgeExpiredDedup(opts?: {
    at?: Date
    retentionDays?: number
  }): Promise<number> {
    const now = opts?.at ?? new Date()
    const retentionDays = opts?.retentionDays ?? DEDUP_RETENTION_DAYS
    const cutoff = utcDateString(
      new Date(now.getTime() - retentionDays * 86_400_000)
    )
    const res = await this.pool.query(
      "DELETE FROM daily_unique_click_dedup WHERE bucket_date < $1",
      [cutoff]
    )
    return res.rowCount ?? 0
  }

  /** Build the aggregated analytics payload for a short code. Null if unknown. */
  async getAnalytics(
    shortCode: string,
    at?: Date
  ): Promise<AnalyticsResultType | null> {
    const now = at ?? new Date()

    const urlRes = await this.pool.query(
      "SELECT id FROM urls WHERE short_code = $1",
      [shortCode]
    )
    if (!urlRes.rows[0]) return null
    const urlId: number = urlRes.rows[0].id

    const [bucketRes, countryRes] = await Promise.all([
      this.pool.query(
        `SELECT bucket_type, bucket_start, clicks_count, unique_estimated_count
         FROM click_analytics_buckets WHERE url_id = $1`,
        [urlId]
      ),
      this.pool.query(
        `SELECT country_code, SUM(clicks_count)::int AS clicks
         FROM click_country_analytics WHERE url_id = $1
         GROUP BY country_code`,
        [urlId]
      ),
    ])

    const buckets = bucketRes.rows as BucketRow[]
    const countries = countryRes.rows as CountryRow[]

    const todayStr = utcDateString(now)
    // Windows keep the payload small; charts only need recent history.
    const hourFloor = now.getTime() - 48 * 3_600_000
    const dayFloor = now.getTime() - 90 * 86_400_000

    const series = (type: string, floor: number) =>
      buckets
        .filter((b) => b.bucket_type === type)
        .map((b) => ({
          bucketStart: new Date(b.bucket_start),
          clicks: b.clicks_count,
          unique: b.unique_estimated_count,
        }))
        .filter((p) => p.bucketStart.getTime() >= floor)
        .sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime())

    const daySeries = buckets.filter((b) => b.bucket_type === "day")
    const totalClicks = daySeries.reduce((s, b) => s + b.clicks_count, 0)
    const uniqueToday =
      daySeries.find(
        (b) => utcDateString(new Date(b.bucket_start)) === todayStr
      )?.unique_estimated_count ?? 0

    return AnalyticsResult.parse({
      shortCode,
      generatedAt: now,
      totalClicks,
      uniqueToday,
      hourly: series("hour", hourFloor),
      daily: series("day", dayFloor),
      monthly: series("month", -Infinity),
      countries: countries
        .map((c) => ({ countryCode: c.country_code, clicks: c.clicks }))
        .sort((a, b) => b.clicks - a.clicks),
    })
  }
}

export const analyticsService = new AnalyticsService()
