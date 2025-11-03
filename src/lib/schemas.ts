import { z } from "zod"

export const URLRecord = z.object({
  id: z.coerce.number(),
  is_custom: z.boolean(),
  original_url: z.string().url(),
  short_code: z.string().min(3).max(20),
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
})

export type PaginatedUrlsResponse = z.infer<typeof PaginatedUrlsResponse>
export type GetUrlsQueryParams = z.infer<typeof GetUrlsQueryParams>
export type UrlsQueryParams = Partial<GetUrlsQueryParams>
