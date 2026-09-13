"use client"

import type { AnalyticsBucketPoint } from "@/lib/schemas"

type BucketType = "hour" | "day" | "month"

// All bucket_start values are UTC-truncated, so format them in UTC to match.
function labelFor(date: Date, type: BucketType): string {
  const opts: Intl.DateTimeFormatOptions =
    type === "hour"
      ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }
      : type === "day"
        ? { month: "short", day: "numeric", timeZone: "UTC" }
        : { month: "short", year: "numeric", timeZone: "UTC" }
  return new Intl.DateTimeFormat(undefined, opts).format(date)
}

function fullLabelFor(date: Date, type: BucketType): string {
  const opts: Intl.DateTimeFormatOptions =
    type === "month"
      ? { month: "long", year: "numeric", timeZone: "UTC" }
      : {
          dateStyle: "medium",
          ...(type === "hour" ? { timeStyle: "short" } : {}),
          timeZone: "UTC",
        }
  return new Intl.DateTimeFormat(undefined, opts).format(date)
}

/**
 * Pad a sparse series with zero-count buckets so the chart shows an even,
 * continuous timeline instead of only the buckets that happened to get clicks.
 */
function densify(
  points: AnalyticsBucketPoint[],
  type: BucketType,
  now: Date
): AnalyticsBucketPoint[] {
  const byTime = new Map(points.map((p) => [p.bucketStart.getTime(), p]))
  const out: AnalyticsBucketPoint[] = []

  // Months vary in length, so step by calendar month rather than by a fixed
  // number of milliseconds (Date.UTC normalises negative months across years).
  if (type === "month") {
    const count = 12
    for (let i = count - 1; i >= 0; i--) {
      const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
      out.push(
        byTime.get(t) ?? { bucketStart: new Date(t), clicks: 0, unique: 0 }
      )
    }
    return out
  }

  const count = type === "hour" ? 24 : 14
  const stepMs = type === "hour" ? 3_600_000 : 86_400_000
  const end =
    type === "hour"
      ? Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours()
        )
      : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  for (let i = count - 1; i >= 0; i--) {
    const t = end - i * stepMs
    out.push(
      byTime.get(t) ?? { bucketStart: new Date(t), clicks: 0, unique: 0 }
    )
  }
  return out
}

export function BarChart({
  points,
  type,
  now = new Date(),
}: {
  points: AnalyticsBucketPoint[]
  type: BucketType
  now?: Date
}) {
  const data = densify(points, type, now)
  const max = Math.max(1, ...data.map((p) => p.clicks))
  const hasClicks = data.some((p) => p.clicks > 0)

  if (data.length === 0 || !hasClicks) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No clicks in this window yet.
      </p>
    )
  }

  // Show at most ~12 x-axis labels to avoid crowding.
  const labelEvery = Math.ceil(data.length / 12)

  return (
    <div className="flex flex-col gap-1 min-w-0 overflow-hidden">
      {/* Visual chart — decorative; the sr-only table below carries the data. */}
      <div
        className="flex items-end gap-[3px] h-40 overflow-hidden"
        aria-hidden="true"
      >
        {data.map((p) => {
          const heightPct = (p.clicks / max) * 100
          return (
            <div
              key={p.bucketStart.getTime()}
              className="flex-1 min-w-0 flex flex-col justify-end items-center h-full group"
              title={`${fullLabelFor(p.bucketStart, type)} — ${p.clicks} clicks, ${p.unique} unique`}
            >
              <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {p.clicks}
              </span>
              <div
                className="w-full rounded-sm bg-blue-500/80 hover:bg-blue-400 transition-colors min-h-[2px]"
                style={{
                  height: `${Math.max(heightPct, p.clicks > 0 ? 4 : 0)}%`,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-[3px]" aria-hidden="true">
        {data.map((p, i) => (
          <div
            key={p.bucketStart.getTime()}
            className="flex-1 text-center text-[9px] text-muted-foreground truncate"
          >
            {i % labelEvery === 0 ? labelFor(p.bucketStart, type) : ""}
          </div>
        ))}
      </div>
      {/* Accessible equivalent for keyboard / screen-reader users.
          The outer div (not the table) carries sr-only so that the table's
          natural height — browsers treat height:1px on <table> as min-height,
          not a fixed height — doesn't create phantom scroll area in the dialog. */}
      <div className="sr-only">
        <table>
          <caption>Clicks by {type}</caption>
          <thead>
            <tr>
              <th>Period</th>
              <th>Clicks</th>
              <th>Unique</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.bucketStart.getTime()}>
                <td>{fullLabelFor(p.bucketStart, type)}</td>
                <td>{p.clicks}</td>
                <td>{p.unique}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Tiny inline sparkline for compact summaries (recent daily trend). */
export function Sparkline({
  points,
  now = new Date(),
}: {
  points: AnalyticsBucketPoint[]
  now?: Date
}) {
  // Densify to the last 14 calendar days so gaps show as gaps, not compressed.
  const data = densify(points, "day", now)
  const max = Math.max(1, ...data.map((p) => p.clicks))
  const total = data.reduce((s, p) => s + p.clicks, 0)
  return (
    <div
      className="flex items-end gap-[2px] h-6"
      role="img"
      aria-label={`Recent daily clicks: ${total} over the last ${data.length} days`}
    >
      {data.map((p) => (
        <div
          key={p.bucketStart.getTime()}
          aria-hidden="true"
          className="w-1 rounded-sm bg-blue-500/70 min-h-[1px]"
          style={{
            height: `${Math.max((p.clicks / max) * 100, p.clicks > 0 ? 12 : 4)}%`,
          }}
        />
      ))}
    </div>
  )
}

/** ISO alpha-2 → display name; falls back to the raw value (e.g. "Unknown"). */
export function countryName(code: string): string {
  if (code === "Unknown") return "Unknown"
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "region" })
    return dn.of(code) ?? code
  } catch {
    return code
  }
}
