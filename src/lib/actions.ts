"use server"

import type { SubmissionResult } from "@conform-to/react"
import { parseWithZod } from "@conform-to/zod"
import { canWrite, getRole } from "./auth"
import { urlService } from "./url-service"
import { createUrlSchema, editUrlSchema } from "./validations"

const FORBIDDEN = "You don't have permission to modify URLs"

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

  if (!canWrite(await getRole())) {
    result.error = FORBIDDEN
    return result
  }

  if (submission.status === "success") {
    try {
      await urlService.createShortUrl(
        submission.value.url,
        submission.value.shortCode,
        submission.value.tags
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

  if (!canWrite(await getRole())) {
    result.error = FORBIDDEN
    return result
  }

  if (submission.status === "success") {
    try {
      await urlService.updateUrl(
        submission.value.shortCode,
        submission.value.url,
        submission.value.tags
      )
      result.error = null
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : "Failed to update URL"
    }
  }
  return result
}

export async function deleteUrl(
  shortCode: string
): Promise<{ error: string | null }> {
  if (!canWrite(await getRole())) {
    return { error: FORBIDDEN }
  }

  try {
    const deleted = await urlService.deleteUrl(shortCode)
    return { error: deleted ? null : "URL not found" }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete URL",
    }
  }
}
