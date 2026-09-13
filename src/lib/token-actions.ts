"use server"

import type { SubmissionResult } from "@conform-to/react"
import { parseWithZod } from "@conform-to/zod"
import { apiTokenService, type TokenOwner } from "./api-tokens"
import { canRead, getRole, getSession, type Role } from "./auth"
import { type ApiTokenSummary, CreatedApiToken } from "./schemas"
import { createApiTokenSchema } from "./validations"

const NOT_AUTHENTICATED = "You must be signed in to manage API tokens"

/** The logged in user and their role, or `null` when there isn't one. */
async function currentOwner(): Promise<{
  owner: TokenOwner
  role: Role
} | null> {
  const role = await getRole()
  if (!canRead(role)) return null
  const session = await getSession()
  if (!session.userInfo) return null
  return { owner: session.userInfo, role }
}

export async function listApiTokens(): Promise<ApiTokenSummary[]> {
  const current = await currentOwner()
  if (!current) return []
  return apiTokenService.list(current.owner.sub)
}

export async function createApiToken(
  prevState: {
    error: string | null
    lastResult: SubmissionResult<string[]> | null
    createdToken: CreatedApiToken | null
  },
  formData: FormData
) {
  const submission = parseWithZod(formData, { schema: createApiTokenSchema })

  const result: typeof prevState = {
    ...prevState,
    error: null,
    lastResult: submission.reply(),
    createdToken: null,
  }

  const current = await currentOwner()
  if (!current) {
    result.error = NOT_AUTHENTICATED
    return result
  }

  if (submission.status === "success") {
    try {
      // a viewer can only ever mint viewer-level tokens for themselves,
      // regardless of what the form requested
      const role = current.role === "admin" ? submission.value.role : "viewer"
      const { token, record } = await apiTokenService.create(
        current.owner,
        submission.value.name,
        role
      )
      result.createdToken = CreatedApiToken.parse({ ...record, token })
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : "Failed to create API token"
    }
  }
  return result
}

export async function revokeApiToken(
  id: number
): Promise<{ error: string | null }> {
  const current = await currentOwner()
  if (!current) return { error: NOT_AUTHENTICATED }

  const revoked = await apiTokenService.revoke(id, current.owner.sub)
  return { error: revoked ? null : "API token not found" }
}
