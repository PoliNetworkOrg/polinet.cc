import { createNextHandler } from "@ts-rest/serverless/next"
import { apiTokenService, parseBearerToken } from "@/lib/api-tokens"
import { canRead, canWrite, isAuthEnabled, type Role } from "@/lib/auth"
import { contract } from "@/lib/contract"
import { urlService } from "@/lib/url-service"

/** Resolves the caller's role from the `Authorization` header, if any. */
async function resolveRole(authorization?: string): Promise<Role | null> {
  // no OIDC configured for this deployment: the whole app is unauthenticated
  if (!isAuthEnabled) return "admin"

  const token = parseBearerToken(authorization)
  if (!token) return null

  const auth = await apiTokenService.verify(token)
  return auth?.role ?? null
}

type AuthResult =
  | { ok: true }
  | { ok: false; response: { status: 401 | 403; body: { error: string } } }

/** Gates a handler behind `check`, returning a 401/403 body when it fails. */
async function authorize(
  headers: { authorization?: string },
  check: (role: Role | null) => boolean
): Promise<AuthResult> {
  const role = await resolveRole(headers.authorization)
  if (!role) {
    return {
      ok: false,
      response: {
        status: 401,
        body: { error: "Missing or invalid API token" },
      },
    }
  }
  if (!check(role)) {
    return {
      ok: false,
      response: {
        status: 403,
        body: {
          error: "This API token does not have permission for this operation",
        },
      },
    }
  }
  return { ok: true }
}

const handler = createNextHandler(
  contract,
  {
    getAllUrls: async ({ query, headers }) => {
      const auth = await authorize(headers, canRead)
      if (!auth.ok) return auth.response

      const result = await urlService.getAllUrls({
        page: query.page,
        limit: query.limit,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        customOnly: query.customOnly,
        tag: query.tag,
      })
      return {
        status: 200,
        body: result,
      }
    },
    createUrl: async ({ body, headers }) => {
      const auth = await authorize(headers, canWrite)
      if (!auth.ok) return auth.response

      try {
        const urlRecord = await urlService.createShortUrl(
          body.url,
          body.shortCode,
          body.tags
        )
        return {
          status: 201,
          body: urlRecord,
        }
      } catch (error) {
        return {
          status: 400,
          body: {
            error:
              error instanceof Error ? error.message : "Failed to create URL",
          },
        }
      }
    },
    getUrl: async ({ params, headers }) => {
      const auth = await authorize(headers, canRead)
      if (!auth.ok) return auth.response

      const urlRecord = await urlService.getUrlByShortCode(params.shortCode)
      if (!urlRecord) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      return {
        status: 200,
        body: urlRecord,
      }
    },
    updateUrl: async ({ params, body, headers }) => {
      const auth = await authorize(headers, canWrite)
      if (!auth.ok) return auth.response

      const urlRecord = await urlService.updateUrl(
        params.shortCode,
        body.url,
        body.tags
      )
      if (!urlRecord) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      return {
        status: 200,
        body: urlRecord,
      }
    },
    deleteUrl: async ({ params, headers }) => {
      const auth = await authorize(headers, canWrite)
      if (!auth.ok) return auth.response

      const deleted = await urlService.deleteUrl(params.shortCode)
      if (!deleted) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      return {
        status: 204,
        body: undefined,
      }
    },
    getAllTags: async ({ headers }) => {
      const auth = await authorize(headers, canRead)
      if (!auth.ok) return auth.response

      const tags = await urlService.getAllTags()
      return {
        status: 200,
        body: tags,
      }
    },
    addTag: async ({ params, body, headers }) => {
      const auth = await authorize(headers, canWrite)
      if (!auth.ok) return auth.response

      const urlRecord = await urlService.getUrlByShortCode(params.shortCode)
      if (!urlRecord) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      await urlService.addTag(urlRecord.id, body.tagName)
      return {
        status: 201,
        body: undefined,
      }
    },
    removeTag: async ({ params, headers }) => {
      const auth = await authorize(headers, canWrite)
      if (!auth.ok) return auth.response

      const urlRecord = await urlService.getUrlByShortCode(params.shortCode)
      if (!urlRecord) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      await urlService.removeTag(
        urlRecord.id,
        decodeURIComponent(params.tagName)
      )
      return {
        status: 204,
        body: undefined,
      }
    },
  },
  {
    handlerType: "app-router",
    basePath: "/api",
  }
)

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
}
