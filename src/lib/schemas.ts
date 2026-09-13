import { z } from "zod"

export const URLRecord = z.object({
  id: z.coerce.number(),
  is_custom: z.boolean(),
  tags: z.array(z.string()).optional().default([]),
  original_url: z.string().url(),
  short_code: z.string().max(25),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  click_count: z.number().int().nonnegative(),
})
export const URLRecords = z.array(URLRecord)

export type UrlRecord = z.infer<typeof URLRecord>
export type UrlRecords = z.infer<typeof URLRecords>

export const PaginatedUrlsResponse = z.object({
  urls: z.array(URLRecord),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
})

export const GetUrlsQueryParams = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  search: z.string().optional(),
  sortBy: z
    .enum(["created_at", "updated_at", "click_count", "short_code"])
    .optional()
    .default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  customOnly: z.coerce.boolean().optional().default(false),
  // filter by a single tag name (URL appears if it owns that tag)
  tag: z.string().optional(),
})

export type PaginatedUrlsResponse = z.infer<typeof PaginatedUrlsResponse>
export type GetUrlsQueryParams = z.infer<typeof GetUrlsQueryParams>
export type UrlsQueryParams = Partial<GetUrlsQueryParams>

// ── Analytics (privacy-preserving, aggregated) ───────────────────────────────

export const AnalyticsBucketPoint = z.object({
  bucketStart: z.coerce.date(),
  clicks: z.number().int().nonnegative(),
  unique: z.number().int().nonnegative(),
})

export const AnalyticsCountryPoint = z.object({
  countryCode: z.string(),
  clicks: z.number().int().nonnegative(),
})

export const AnalyticsResult = z.object({
  shortCode: z.string(),
  generatedAt: z.coerce.date(),
  totalClicks: z.number().int().nonnegative(),
  uniqueToday: z.number().int().nonnegative(),
  hourly: z.array(AnalyticsBucketPoint),
  daily: z.array(AnalyticsBucketPoint),
  monthly: z.array(AnalyticsBucketPoint),
  countries: z.array(AnalyticsCountryPoint),
})

export type AnalyticsBucketPoint = z.infer<typeof AnalyticsBucketPoint>
export type AnalyticsCountryPoint = z.infer<typeof AnalyticsCountryPoint>
export type AnalyticsResult = z.infer<typeof AnalyticsResult>
