import { initContract } from "@ts-rest/core"
import z from "zod"
import { GetUrlsQueryParams, PaginatedUrlsResponse, URLRecord } from "./schemas"
import { createUrlSchema } from "./validations"

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
})
