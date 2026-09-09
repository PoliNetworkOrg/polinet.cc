import { createNextHandler } from "@ts-rest/serverless/next"
import { contract } from "@/lib/contract"
import { urlService } from "@/lib/url-service"

const handler = createNextHandler(
  contract,
  {
    getAllUrls: async ({ query }) => {
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
    createUrl: async ({ body }) => {
      try {
        const urlRecord = await urlService.createShortUrl(
          body.url,
          body.shortCode,
          body.aliases,
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
    updateUrl: async ({ params, body }) => {
      const urlRecord = await urlService.updateUrl(
        params.shortCode,
        body.url,
        body.aliases,
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
    addAlias: async ({ params, body }) => {
      const urlRecord = await urlService.getUrlByShortCode(params.shortCode)
      if (!urlRecord) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      try {
        await urlService.addAlias(urlRecord.id, body.aliasCode)
        return {
          status: 201,
          body: undefined,
        }
      } catch (error) {
        return {
          status: 400,
          body: {
            error:
              error instanceof Error ? error.message : "Failed to add alias",
          },
        }
      }
    },
    removeAlias: async ({ params }) => {
      const urlRecord = await urlService.getUrlByShortCode(params.shortCode)
      if (!urlRecord) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      const removed = await urlService.removeAlias(
        urlRecord.id,
        params.aliasCode
      )
      if (!removed) {
        return {
          status: 404,
          body: { error: "Alias not found" },
        }
      }
      return {
        status: 204,
        body: undefined,
      }
    },
    promoteAlias: async ({ params }) => {
      const urlRecord = await urlService.getUrlByShortCode(params.shortCode)
      if (!urlRecord) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      const promoted = await urlService.promoteAlias(
        urlRecord.id,
        params.aliasCode
      )
      if (!promoted) {
        return {
          status: 404,
          body: { error: "Alias not found" },
        }
      }
      return {
        status: 200,
        body: promoted,
      }
    },
    getAliasStats: async ({ params }) => {
      const stats = await urlService.getAliasStats(params.shortCode)
      if (!stats) {
        return {
          status: 404,
          body: { error: "URL not found" },
        }
      }
      return {
        status: 200,
        body: stats,
      }
    },
    getAllTags: async () => {
      const tags = await urlService.getAllTags()
      return {
        status: 200,
        body: tags,
      }
    },
    addTag: async ({ params, body }) => {
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
    removeTag: async ({ params }) => {
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
