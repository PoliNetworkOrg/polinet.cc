"use server"

import type { SubmissionResult } from "@conform-to/react"
import { parseWithZod } from "@conform-to/zod"
import { canRead, canWrite, getRole } from "./auth"
import type { AliasStatsResult, UrlRecord } from "./schemas"
import { CodeConflictError, urlService } from "./url-service"
import { aliasSchema, createUrlSchema, editUrlSchema } from "./validations"

const FORBIDDEN = "You don't have permission to modify URLs"

type FormActionState = {
  error: string | null
  lastResult: SubmissionResult<string[]> | null
}

/**
 * A valid form replies with status "success" even when the server-side work
 * then fails, which the dialogs read as success and close. Reply with the
 * failure as a form error instead.
 */
function withFormError(
  state: FormActionState,
  submission: {
    reply: (options: { formErrors: string[] }) => SubmissionResult<string[]>
  },
  error: string
): FormActionState {
  return {
    ...state,
    error,
    lastResult: submission.reply({ formErrors: [error] }),
  }
}

export async function createUrl(
  // required by useActionState; every submission starts from a clean state
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const submission = parseWithZod(formData, { schema: createUrlSchema })

  const result: FormActionState = {
    error: null,
    lastResult: submission.reply(),
  }

  if (!canWrite(await getRole())) {
    return withFormError(result, submission, FORBIDDEN)
  }

  if (submission.status === "success") {
    try {
      await urlService.createShortUrl(
        submission.value.url,
        submission.value.shortCode,
        submission.value.tags,
        submission.value.aliases
      )
      result.error = null
    } catch (error) {
      return withFormError(
        result,
        submission,
        errorMessage(error, "Failed to create URL")
      )
    }
  }
  return result
}

export async function editUrl(
  // required by useActionState; every submission starts from a clean state
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const submission = parseWithZod(formData, { schema: editUrlSchema })
  const result: FormActionState = {
    error: null,
    lastResult: submission.reply(),
  }

  if (!canWrite(await getRole())) {
    return withFormError(result, submission, FORBIDDEN)
  }

  if (submission.status === "success") {
    try {
      const { currentShortCode, shortCode, url, aliases, tags } =
        submission.value
      const updated = await urlService.updateUrl(currentShortCode, url, tags, {
        aliases,
        newShortCode: shortCode,
      })
      if (!updated) return withFormError(result, submission, "URL not found")
    } catch (error) {
      return withFormError(
        result,
        submission,
        errorMessage(error, "Failed to update URL")
      )
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

type ActionResult<T = null> = { error: string } | { error: null; data: T }

/**
 * Shows a code conflict to the user as is. Anything else is logged and
 * replaced by `fallback`, so database errors don't reach the browser.
 */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof CodeConflictError) return error.message
  console.error(error)
  return fallback
}

function failure(error: unknown, fallback: string): { error: string } {
  // returned rather than thrown: thrown errors reach the client redacted
  return { error: errorMessage(error, fallback) }
}

export async function getAliasStats(
  shortCode: string
): Promise<ActionResult<AliasStatsResult>> {
  if (!canRead(await getRole())) {
    return { error: "You don't have permission to view URLs" }
  }
  try {
    const stats = await urlService.getAliasStats(shortCode)
    return stats ? { error: null, data: stats } : { error: "URL not found" }
  } catch (error) {
    return failure(error, "Failed to load alias stats")
  }
}

export async function addAlias(
  urlId: number,
  aliasCode: string
): Promise<ActionResult> {
  if (!canWrite(await getRole())) return { error: FORBIDDEN }
  const parsed = aliasSchema.safeParse({ aliasCode: aliasCode.trim() })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid alias" }
  }
  try {
    const added = await urlService.addAlias(urlId, parsed.data.aliasCode)
    return added ? { error: null, data: null } : { error: "URL not found" }
  } catch (error) {
    return failure(error, "Failed to add alias")
  }
}

export async function removeAlias(
  urlId: number,
  aliasCode: string
): Promise<ActionResult> {
  if (!canWrite(await getRole())) return { error: FORBIDDEN }
  try {
    const removed = await urlService.removeAlias(urlId, aliasCode)
    return removed ? { error: null, data: null } : { error: "Alias not found" }
  } catch (error) {
    return failure(error, "Failed to remove alias")
  }
}

export async function promoteAlias(
  urlId: number,
  aliasCode: string
): Promise<ActionResult<UrlRecord>> {
  if (!canWrite(await getRole())) return { error: FORBIDDEN }
  try {
    const promoted = await urlService.promoteAlias(urlId, aliasCode)
    return promoted
      ? { error: null, data: promoted }
      : { error: "Alias not found" }
  } catch (error) {
    return failure(error, "Failed to promote alias")
  }
}
