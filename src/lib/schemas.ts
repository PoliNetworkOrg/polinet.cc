import { z } from "zod"

export const URLRecord = z.object({
  id: z.string(),
  original_url: z.string().url(),
  short_code: z.string().min(3).max(20),
  created_at: z.date(),
  updated_at: z.date(),
  click_count: z.number().int().nonnegative(),
})
export const URLRecords = z.array(URLRecord)

export type UrlRecord = z.infer<typeof URLRecord>
export type UrlRecords = z.infer<typeof URLRecords>
