"use server"

import type { SubmissionResult } from "@conform-to/react"
import { parseWithZod } from "@conform-to/zod"
import { urlService } from "./url-service"
import { createUrlSchema, editUrlSchema } from "./validations"

export async function createUrl(
  prevState: {
    error: string | null
    lastResult: SubmissionResult<string[]> | null
  },
  formData: FormData
) {
  const submission = parseWithZod(formData, { schema: createUrlSchema })

  const result: typeof prevState = {
    ...prevState,
    lastResult: submission.reply(),
  }

  if (submission.status === "success") {
    try {
      await urlService.createShortUrl(
        submission.value.url,
        submission.value.shortCode
      )
      result.error = null
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : "Failed to create URL"
    }
  }
  return result
}

export async function editUrl(
  prevState: {
    error: string | null
    lastResult: SubmissionResult<string[]> | null
  },
  formData: FormData
) {
  const submission = parseWithZod(formData, { schema: editUrlSchema })
  const result: typeof prevState = {
    ...prevState,
    lastResult: submission.reply(),
  }

  if (submission.status === "success") {
    try {
      await urlService.updateUrl(
        submission.value.shortCode,
        submission.value.url
      )
      result.error = null
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : "Failed to update URL"
    }
  }
  return result
}
