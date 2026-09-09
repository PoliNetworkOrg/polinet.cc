import { z } from "zod"

export const shortCodeValidator = z
  .string()
  .min(2, "Short code must be at least 2 characters")
  .max(25, "Short code must be at most 25 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Short code can only contain letters, numbers, hyphens and underscores"
  )

const tagValidator = z.string().trim().min(1).max(50)

export const createUrlSchema = z.object({
  url: z.string().url("Invalid URL format"),
  shortCode: shortCodeValidator.optional(),
  aliases: z.array(shortCodeValidator).default([]),
  tags: z.array(tagValidator).default([]),
})

export type CreateUrlInput = z.infer<typeof createUrlSchema>

export const editUrlSchema = createUrlSchema.extend({
  // Hidden field: the code the row is currently stored under, used to locate
  // it. `shortCode` is the (possibly renamed) value the user submitted.
  currentShortCode: shortCodeValidator,
  shortCode: shortCodeValidator,
})

export const aliasSchema = z.object({
  aliasCode: shortCodeValidator,
})

export const tagSchema = z.object({
  tagName: tagValidator,
})
