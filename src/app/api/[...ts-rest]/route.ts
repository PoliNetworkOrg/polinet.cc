import { createNextHandler } from "@ts-rest/serverless/next"
import { contract } from "@/lib/contract"
import { generateQR } from "@/lib/qr/server"
import { urlService } from "@/lib/url-service"
import { makeShortUrl } from "@/lib/utils"

const handler = createNextHandler(
  contract,
  {
    getAllUrls: async ({ query }) => {
      const result = await urlService.getAllUrls(query)
      return {
        status: 200,
        body: result,
      }
    },
    createUrl: async ({ body }) => {
      try {
        const urlRecord = await urlService.createShortUrl(
          body.url,
          body.shortCode
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
    getUrl: async ({ params }) => {
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
    getQR: async ({ params, query }) => {
      const record = await urlService.getUrlByShortCode(params.shortCode)
      if (!record) return { status: 404, body: { error: "URL not found" } }

      const url = makeShortUrl(record)
      const body = await generateQR(url, 1024, params.ext, query)
      return { status: 200, body }
    },
    updateUrl: async ({ params, body }) => {
      const urlRecord = await urlService.updateUrl(params.shortCode, body.url)
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
    deleteUrl: async ({ params }) => {
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
