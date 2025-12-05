import { initContract } from "@ts-rest/core"
import z from "zod"
import type { QrOptions } from "./qr/config"
import { ImgFileExt } from "./qr/schemas"
import { GetUrlsQueryParams, PaginatedUrlsResponse, URLRecord } from "./schemas"
import { createUrlSchema } from "./validations"

const c = initContract()

const APIError = z.object({
  error: z.string(),
})

export const contract = c.router(
  {
    getAllUrls: {
      summary: "Get all URLs with pagination and filters",
      method: "GET",
      path: "/urls",
      query: GetUrlsQueryParams,
      responses: { 200: PaginatedUrlsResponse },
    },
    getUrl: {
      summary: "Get a URL record by short code",
      method: "GET",
      path: "/urls/:shortCode",
      responses: { 200: URLRecord },
    },
    getQR: {
      summary: "Generate a QR code for the short URL",
      method: "GET",
      path: "/urls/:shortCode/qr.:ext",
      pathParams: z.object({
        shortCode: z.string(),
        ext: ImgFileExt,
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
      summary: "Create a new short URL",
      method: "POST",
      path: "/urls",
      body: createUrlSchema,
      responses: { 201: URLRecord },
    },
    updateUrl: {
      summary: "Update the redirection target of an existing short URL",
      method: "PUT",
      path: "/urls/:shortCode",
      body: createUrlSchema,
      responses: { 200: URLRecord },
    },
    deleteUrl: {
      summary: "Delete a short URL",
      method: "DELETE",
      path: "/urls/:shortCode",
      responses: { 204: c.noBody() },
    },
  },
  {
    commonResponses: {
      400: APIError,
      404: APIError,
      500: APIError,
    },
  }
)
