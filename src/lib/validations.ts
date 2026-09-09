import { z } from "zod"

const tagValidator = z.string().trim().min(1).max(50)

export const editUrlSchema = z.object({
  url: z.string().url("Invalid URL format"),
  shortCode: z
    .string()
    .min(2, "Short code must be at least 2 characters")
    .max(25, "Short code must be at most 25 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Short code can only contain letters, numbers, hyphens and underscores"
    ),
  tags: z.array(tagValidator).default([]),
})

export const createUrlSchema = editUrlSchema.extend({
  shortCode: editUrlSchema.shape.shortCode.optional(),
})

export const tagSchema = z.object({
  tagName: tagValidator,
})
