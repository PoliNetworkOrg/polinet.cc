import { z } from "zod"
import { ApiTokenRole } from "./schemas"

export const shortCodeValidator = z
  .string()
  .min(2, "Short code must be at least 2 characters")
  .max(25, "Short code must be at most 25 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Short code can only contain letters, numbers, hyphens and underscores"
  )

/** Redirect targets must be http(s); `z.url()` also lets `javascript:` through. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

const tagValidator = z.string().trim().min(1).max(50)

// each alias takes a lock while it is claimed, so keep the list bounded
const MAX_ALIASES = 50
const aliasesValidator = z
  .array(shortCodeValidator)
  .max(MAX_ALIASES, `At most ${MAX_ALIASES} aliases per URL`)

export const createUrlSchema = z.object({
  url: z
    .url("Invalid URL format")
    .refine(isHttpUrl, "URL must start with http:// or https://"),
  shortCode: shortCodeValidator.optional(),
  aliases: aliasesValidator.default([]),
  tags: z.array(tagValidator).default([]),
})

export type CreateUrlInput = z.infer<typeof createUrlSchema>

// PUT /urls/:shortCode. Unlike tags, a missing `aliases` keeps the existing
// ones, so clients written before aliases existed don't delete them.
export const updateUrlSchema = createUrlSchema.extend({
  aliases: aliasesValidator
    .optional()
    .describe("Replaces the URL's aliases. Leave out to keep them unchanged."),
})

export const editUrlSchema = createUrlSchema.extend({
  // Hidden field: the code the row is currently stored under, used to locate
  // it. `shortCode` is the (possibly renamed) value the user submitted.
  currentShortCode: shortCodeValidator,
  shortCode: shortCodeValidator,
  // Hidden fields: the aliases the form was opened with. The action applies
  // only what the user added or removed, so aliases added elsewhere since
  // the list loaded are kept.
  initialAliases: aliasesValidator.default([]),
})

export const aliasSchema = z.object({
  aliasCode: shortCodeValidator,
})

export const tagSchema = z.object({
  tagName: tagValidator,
})

export const createApiTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  role: ApiTokenRole,
})
