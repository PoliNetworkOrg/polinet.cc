import type { Pool } from "pg"
import { newDb } from "pg-mem"
import { describe, expect, it } from "vitest"
import { ANALYTICS_SCHEMA_SQL } from "./analytics-schema"
import {
  AnalyticsService,
  computeDailyVisitorHash,
  dayBucket,
  hourBucket,
  monthBucket,
  normalizeCountry,
  utcDateString,
} from "./analytics-service"

const SECRET = "test-analytics-secret-abcdefzz"
const RAW_IP = "203.0.113.7"
const RAW_UA = "Mozilla/5.0 (SecretDevice; rv:1.0) Gecko/20100101 Firefox/1.0"

// Minimal slice of the real schema needed for analytics (just urls), then the
// shared analytics DDL.
const BASE_SCHEMA = `
  CREATE TABLE urls (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(25) UNIQUE NOT NULL,
    original_url TEXT NOT NULL
  );
`

async function setup() {
  const mem = newDb()
  const pg = mem.adapters.createPg()
  const pool = new pg.Pool() as unknown as Pool
  await pool.query(BASE_SCHEMA)
  await pool.query(ANALYTICS_SCHEMA_SQL)

  const url = await pool.query(
    "INSERT INTO urls (short_code, original_url) VALUES ($1, $2) RETURNING id",
    ["abc", "https://example.com"]
  )
  const urlId: number = url.rows[0].id

  const service = new AnalyticsService({ pool, secret: SECRET })
  return { pool, service, urlId }
}

const D1 = new Date("2026-07-18T10:30:00Z")
const D1_LATER = new Date("2026-07-18T22:00:00Z")
const D2 = new Date("2026-07-19T09:00:00Z")

describe("pure helpers", () => {
  it("utcDateString formats as YYYY-MM-DD in UTC", () => {
    expect(utcDateString(D1)).toBe("2026-07-18")
  })

  it("hourBucket/dayBucket/monthBucket truncate to UTC boundaries", () => {
    expect(hourBucket(D1).toISOString()).toBe("2026-07-18T10:00:00.000Z")
    expect(dayBucket(D1).toISOString()).toBe("2026-07-18T00:00:00.000Z")
    expect(monthBucket(D1).toISOString()).toBe("2026-07-01T00:00:00.000Z")
  })

  it("normalizeCountry accepts a valid alpha-2 code and rejects everything else", () => {
    expect(normalizeCountry("us")).toBe("US")
    expect(normalizeCountry(null)).toBe("Unknown")
    expect(normalizeCountry("United States")).toBe("Unknown")
  })
})

describe("computeDailyVisitorHash", () => {
  it("is deterministic for identical inputs", () => {
    const a = computeDailyVisitorHash(SECRET, {
      urlId: 1,
      dateStr: "2026-07-18",
      ip: RAW_IP,
      userAgent: RAW_UA,
    })
    const b = computeDailyVisitorHash(SECRET, {
      urlId: 1,
      dateStr: "2026-07-18",
      ip: RAW_IP,
      userAgent: RAW_UA,
    })
    expect(a).toBe(b)
  })

  it("rotates when the date changes", () => {
    const day1 = computeDailyVisitorHash(SECRET, {
      urlId: 1,
      dateStr: "2026-07-18",
      ip: RAW_IP,
      userAgent: RAW_UA,
    })
    const day2 = computeDailyVisitorHash(SECRET, {
      urlId: 1,
      dateStr: "2026-07-19",
      ip: RAW_IP,
      userAgent: RAW_UA,
    })
    expect(day1).not.toBe(day2)
  })

  it("differs across links (urlId)", () => {
    const linkA = computeDailyVisitorHash(SECRET, {
      urlId: 1,
      dateStr: "2026-07-18",
      ip: RAW_IP,
      userAgent: RAW_UA,
    })
    const linkB = computeDailyVisitorHash(SECRET, {
      urlId: 2,
      dateStr: "2026-07-18",
      ip: RAW_IP,
      userAgent: RAW_UA,
    })
    expect(linkA).not.toBe(linkB)
  })
})

describe("AnalyticsService", () => {
  it("returns null for an unknown short code", async () => {
    const { service } = await setup()
    expect(await service.getAnalytics("nope")).toBeNull()
  })

  it("records a click and reflects it in totals and buckets", async () => {
    const { service, urlId } = await setup()

    await service.recordClick({
      urlId,
      ip: RAW_IP,
      userAgent: RAW_UA,
      country: "US",
      at: D1,
    })

    const analytics = await service.getAnalytics("abc", D1)
    expect(analytics?.totalClicks).toBe(1)
    expect(analytics?.uniqueToday).toBe(1)
    expect(analytics?.countries).toEqual([{ countryCode: "US", clicks: 1 }])
    expect(analytics?.hourly).toHaveLength(1)
    expect(analytics?.daily).toHaveLength(1)
    expect(analytics?.monthly).toHaveLength(1)
  })

  it("counts a same-day repeat visitor once for the unique estimate but twice for total clicks", async () => {
    const { service, urlId } = await setup()

    await service.recordClick({
      urlId,
      ip: RAW_IP,
      userAgent: RAW_UA,
      country: "US",
      at: D1,
    })
    await service.recordClick({
      urlId,
      ip: RAW_IP,
      userAgent: RAW_UA,
      country: "US",
      at: D1_LATER,
    })

    const analytics = await service.getAnalytics("abc", D1_LATER)
    expect(analytics?.totalClicks).toBe(2)
    expect(analytics?.uniqueToday).toBe(1)
    // Same UTC hour bucket only for D1/D1_LATER? They're different hours, so 2 hourly buckets.
    expect(analytics?.hourly).toHaveLength(2)
    expect(analytics?.daily).toHaveLength(1)
    expect(analytics?.daily[0].clicks).toBe(2)
  })

  it("counts concurrent same-visitor clicks as exactly one unique", async () => {
    const { service, urlId } = await setup()

    // Both requests race to record the same visitor at (effectively) the
    // same instant. The dedup insert's unique constraint must let only one
    // of them win the "first sighting" — a check-then-insert race would let
    // both count a unique.
    await Promise.all([
      service.recordClick({
        urlId,
        ip: RAW_IP,
        userAgent: RAW_UA,
        country: "US",
        at: D1,
      }),
      service.recordClick({
        urlId,
        ip: RAW_IP,
        userAgent: RAW_UA,
        country: "US",
        at: D1,
      }),
    ])

    const analytics = await service.getAnalytics("abc", D1)
    expect(analytics?.totalClicks).toBe(2)
    expect(analytics?.uniqueToday).toBe(1)
  })

  it("counts the same visitor again as a new unique the next day", async () => {
    const { service, urlId } = await setup()

    await service.recordClick({
      urlId,
      ip: RAW_IP,
      userAgent: RAW_UA,
      country: "US",
      at: D1,
    })
    await service.recordClick({
      urlId,
      ip: RAW_IP,
      userAgent: RAW_UA,
      country: "US",
      at: D2,
    })

    const analytics = await service.getAnalytics("abc", D2)
    expect(analytics?.totalClicks).toBe(2)
    expect(analytics?.uniqueToday).toBe(1)
    expect(analytics?.daily).toHaveLength(2)
    expect(analytics?.daily.every((d) => d.unique === 1)).toBe(true)
  })

  it("aggregates clicks from different countries", async () => {
    const { service, urlId } = await setup()

    await service.recordClick({
      urlId,
      ip: "1.1.1.1",
      userAgent: RAW_UA,
      country: "US",
      at: D1,
    })
    await service.recordClick({
      urlId,
      ip: "2.2.2.2",
      userAgent: RAW_UA,
      country: "IT",
      at: D1,
    })
    await service.recordClick({
      urlId,
      ip: "3.3.3.3",
      userAgent: RAW_UA,
      country: undefined as unknown as string,
      at: D1,
    })

    const analytics = await service.getAnalytics("abc", D1)
    expect(analytics?.totalClicks).toBe(3)
    const byCode = Object.fromEntries(
      analytics?.countries.map((c) => [c.countryCode, c.clicks]) ?? []
    )
    expect(byCode).toEqual({ US: 1, IT: 1, Unknown: 1 })
  })

  it("recordClickSafely never throws, even against a broken pool", async () => {
    const { pool, urlId } = await setup()
    await pool.query("DROP TABLE click_analytics_buckets")
    const service = new AnalyticsService({ pool, secret: SECRET })

    const ok = await service.recordClickSafely({
      urlId,
      ip: RAW_IP,
      userAgent: RAW_UA,
      country: "US",
    })
    expect(ok).toBe(false)
  })

  it("purges dedup rows older than the retention window", async () => {
    const { service, pool, urlId } = await setup()

    await service.recordClick({
      urlId,
      ip: RAW_IP,
      userAgent: RAW_UA,
      country: "US",
      at: D1,
    })

    const before = await pool.query(
      "SELECT COUNT(*) FROM daily_unique_click_dedup"
    )
    expect(Number(before.rows[0].count)).toBe(1)

    const purged = await service.purgeExpiredDedup({
      at: new Date(D1.getTime() + 10 * 86_400_000),
    })
    expect(purged).toBe(1)

    const after = await pool.query(
      "SELECT COUNT(*) FROM daily_unique_click_dedup"
    )
    expect(Number(after.rows[0].count)).toBe(0)
  })
})
