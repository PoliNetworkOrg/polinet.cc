import { initContract } from "@ts-rest/core"
import z from "zod"
import type { QrOptions } from "./qr/config"
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
  getQR: {
    method: "GET",
    path: "/urls/:shortCode/qr.:ext",
    pathParams: z.object({
      shortCode: z.string(),
      ext: z.enum(["png", "svg", "jpeg", "webp"]),
    }),
    query: c.type<Partial<QrOptions>>(),
    responses: {
      200: c.otherResponse({
        contentType: "image/*",
        body: z.instanceof(Blob),
      }),
    },
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
