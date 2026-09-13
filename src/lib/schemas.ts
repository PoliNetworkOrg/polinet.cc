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

// mirrors the `Role` type in "@/lib/auth", duplicated here (rather than
// imported) so this client-safe file never pulls in that server-only module
export const ApiTokenRole = z.enum(["admin", "viewer"])

export const ApiTokenSummary = z.object({
  id: z.coerce.number(),
  name: z.string(),
  role: ApiTokenRole,
  tokenPrefix: z.string(),
  createdAt: z.coerce.date(),
  lastUsedAt: z.coerce.date().nullable(),
})
export type ApiTokenSummary = z.infer<typeof ApiTokenSummary>

/** A freshly created token: the raw secret is only ever available once. */
export const CreatedApiToken = ApiTokenSummary.extend({
  token: z.string(),
})
export type CreatedApiToken = z.infer<typeof CreatedApiToken>
