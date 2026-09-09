import { initContract } from "@ts-rest/core"
import z from "zod"
import {
  AnalyticsResult,
  GetUrlsQueryParams,
  PaginatedUrlsResponse,
  URLRecord,
} from "./schemas"
import { createUrlSchema, tagSchema } from "./validations"

const c = initContract()

const APIError = z.object({
  error: z.string(),
})

export const contract = c.router({
  getAllUrls: {
    method: "GET",
    path: "/urls",
    query: GetUrlsQueryParams,
    responses: {
      200: PaginatedUrlsResponse,
    },
    summary: "Get all URLs with pagination and filters",
  },
  getUrl: {
    method: "GET",
    path: "/urls/:shortCode",
    responses: {
      200: URLRecord,
      404: APIError,
    },
    summary: "Get URL by short code",
  },
  createUrl: {
    method: "POST",
    path: "/urls",
    body: createUrlSchema,
    responses: {
      201: URLRecord,
    },
    summary: "Create a new short URL",
  },
  updateUrl: {
    method: "PUT",
    path: "/urls/:shortCode",
    body: createUrlSchema,
    responses: {
      200: URLRecord,
      404: APIError,
    },
    summary: "Update a short URL",
  },
  deleteUrl: {
    method: "DELETE",
    path: "/urls/:shortCode",
    responses: {
      204: z.void(),
      404: APIError,
    },
    summary: "Delete a short URL",
  },
  getAnalytics: {
    method: "GET",
    path: "/urls/:shortCode/analytics",
    responses: {
      200: AnalyticsResult,
      404: APIError,
    },
    summary: "Get privacy-preserving aggregated click analytics for a URL",
  },
  getAllTags: {
    method: "GET",
    path: "/tags",
    responses: {
      200: z.array(z.string()),
    },
    summary: "Get all distinct tags in use",
  },
  addTag: {
    method: "POST",
    path: "/urls/:shortCode/tags",
    body: tagSchema,
    responses: {
      201: z.void(),
      404: APIError,
    },
    summary: "Add a tag to a URL",
  },
  removeTag: {
    method: "DELETE",
    path: "/urls/:shortCode/tags/:tagName",
    responses: {
      204: z.void(),
      404: APIError,
    },
    summary: "Remove a tag from a URL",
  },
})
