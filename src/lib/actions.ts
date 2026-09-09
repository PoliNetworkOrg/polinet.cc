"use server"

import type { SubmissionResult } from "@conform-to/react"
import { parseWithZod } from "@conform-to/zod"
import type { AliasStatsResult, UrlRecord } from "./schemas"
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
        submission.value.shortCode,
        submission.value.aliases,
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

  if (submission.status === "success") {
    try {
      const { currentShortCode, shortCode, url, aliases, tags } =
        submission.value
      if (shortCode !== currentShortCode) {
        await urlService.renameShortCode(currentShortCode, shortCode)
      }
      await urlService.updateUrl(shortCode, url, aliases, tags)
      result.error = null
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : "Failed to update URL"
    }
  }
  return result
}

export async function getAliasStats(
  shortCode: string
): Promise<AliasStatsResult | null> {
  return urlService.getAliasStats(shortCode)
}

export async function addAliasAction(
  urlId: number,
  aliasCode: string
): Promise<void> {
  await urlService.addAlias(urlId, aliasCode)
}

export async function removeAliasAction(
  urlId: number,
  aliasCode: string
): Promise<void> {
  await urlService.removeAlias(urlId, aliasCode)
}

export async function promoteAliasAction(
  urlId: number,
  aliasCode: string
): Promise<UrlRecord | null> {
  return urlService.promoteAlias(urlId, aliasCode)
}
