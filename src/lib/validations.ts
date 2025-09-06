import { z } from "zod"

export const createUrlSchema = z.object({
  url: z
    .string()
    .url("Invalid URL format")
    .refine((url) => {
      try {
        const urlObj = new URL(url)
        return (
          urlObj.hostname.endsWith(".tommasomorganti.com") ||
          urlObj.hostname === "tommasomorganti.com"
        )
      } catch {
        return false
      }
    }, "URL must be from tommasomorganti.com domain"),
})

export const updateUrlSchema = z.object({
  url: z
    .string()
    .url("Invalid URL format")
    .refine((url) => {
      try {
        const urlObj = new URL(url)
        return (
          urlObj.hostname.endsWith(".tommasomorganti.com") ||
          urlObj.hostname === "tommasomorganti.com"
        )
      } catch {
        return false
      }
    }, "URL must be from tommasomorganti.com domain")
    .optional(),
})

export type CreateUrlInput = z.infer<typeof createUrlSchema>
export type UpdateUrlInput = z.infer<typeof updateUrlSchema>
