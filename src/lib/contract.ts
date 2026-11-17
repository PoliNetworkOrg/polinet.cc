import { initContract } from "@ts-rest/core"
import z from "zod"
import {
  AliasStatsResult,
  GetUrlsQueryParams,
  PaginatedUrlsResponse,
  URLRecord,
} from "./schemas"
import {
  aliasSchema,
  createUrlSchema,
  tagSchema,
  updateUrlSchema,
} from "./validations"

const c = initContract()

const APIError = z.object({
  error: z.string(),
})

// Every endpoint requires a personal API token (created from the /admin
// dashboard's account menu) sent as `Authorization: Bearer <token>`, unless
// authentication is disabled altogether for this deployment.
const AuthHeaders = z.object({
  authorization: z
    .string()
    .optional()
    .describe(
      "`Bearer <token>` — a personal API token created from the /admin dashboard's account menu."
    ),
})

const READ_DESCRIPTION = "Requires a viewer or admin API token."
const WRITE_DESCRIPTION = "Requires an admin API token."

export const contract = c.router(
  {
    getAllUrls: {
      method: "GET",
      path: "/urls",
      query: GetUrlsQueryParams,
      responses: {
        200: PaginatedUrlsResponse,
      },
      summary: "Get all URLs with pagination and filters",
      description: READ_DESCRIPTION,
    },
    getUrl: {
      method: "GET",
      path: "/urls/:shortCode",
      responses: {
        200: URLRecord,
        404: APIError,
      },
      summary: "Get URL by short code",
      description: READ_DESCRIPTION,
    },
    createUrl: {
      method: "POST",
      path: "/urls",
      body: createUrlSchema,
      responses: {
        201: URLRecord,
        400: APIError,
        403: APIError,
      },
      summary: "Create a new short URL",
      description: WRITE_DESCRIPTION,
    },
    updateUrl: {
      method: "PUT",
      path: "/urls/:shortCode",
      body: updateUrlSchema,
      responses: {
        200: URLRecord,
        400: APIError,
        403: APIError,
        404: APIError,
      },
      summary: "Update a short URL",
      description: WRITE_DESCRIPTION,
    },
    deleteUrl: {
      method: "DELETE",
      path: "/urls/:shortCode",
      responses: {
        204: z.void(),
        403: APIError,
        404: APIError,
      },
      summary: "Delete a short URL",
      description: WRITE_DESCRIPTION,
    },
    addAlias: {
      method: "POST",
      path: "/urls/:shortCode/aliases",
      body: aliasSchema,
      responses: {
        201: z.void(),
        400: APIError,
        403: APIError,
        404: APIError,
      },
      summary: "Add an alias to a short URL",
      description: WRITE_DESCRIPTION,
    },
    removeAlias: {
      method: "DELETE",
      path: "/urls/:shortCode/aliases/:aliasCode",
      responses: {
        204: z.void(),
        403: APIError,
        404: APIError,
      },
      summary: "Remove an alias from a short URL",
      description: WRITE_DESCRIPTION,
    },
    promoteAlias: {
      method: "POST",
      path: "/urls/:shortCode/aliases/:aliasCode/promote",
      body: c.noBody(),
      responses: {
        200: URLRecord,
        403: APIError,
        404: APIError,
      },
      summary: "Promote an alias to be the primary short code",
      description: WRITE_DESCRIPTION,
    },
    getAliasStats: {
      method: "GET",
      path: "/urls/:shortCode/alias-stats",
      responses: {
        200: AliasStatsResult,
        404: APIError,
      },
      summary: "Get per-route click stats for a URL's primary code and aliases",
      description: READ_DESCRIPTION,
    },
    getAllTags: {
      method: "GET",
      path: "/tags",
      responses: {
        200: z.array(z.string()),
      },
      summary: "Get all distinct tags in use",
      description: READ_DESCRIPTION,
    },
    addTag: {
      method: "POST",
      path: "/urls/:shortCode/tags",
      body: tagSchema,
      responses: {
        201: z.void(),
        403: APIError,
        404: APIError,
      },
      summary: "Add a tag to a URL",
      description: WRITE_DESCRIPTION,
    },
    removeTag: {
      method: "DELETE",
      path: "/urls/:shortCode/tags/:tagName",
      responses: {
        204: z.void(),
        403: APIError,
        404: APIError,
      },
      summary: "Remove a tag from a URL",
      description: WRITE_DESCRIPTION,
    },
  },
  {
    baseHeaders: AuthHeaders,
    commonResponses: { 401: APIError },
  }
)
