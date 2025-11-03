import { z } from "zod"

export const createUrlSchema = z.object({
  url: z.string().url("Invalid URL format"),
  shortCode: z
    .string()
    .min(2, "Short code must be at least 3 characters")
    .max(20, "Short code must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Short code can only contain letters, numbers, hyphens and underscores"
    )
    .optional(),
})

export type CreateUrlInput = z.infer<typeof createUrlSchema>

export const editUrlSchema = createUrlSchema.extend({
  shortCode: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/),
})
