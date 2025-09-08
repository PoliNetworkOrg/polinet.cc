// import convert from "@openapi-contrib/json-schema-to-openapi-schema"
import { generateOpenApi } from "@ts-rest/open-api"
// import z from "zod"
import { contract } from "@/lib/contract"

// const ZOD_4_ASYNC: SchemaTransformerAsync = async ({ schema }) => {
//   console.log("Converting schema:", schema)
//   try {
//     // biome-ignore lint/suspicious/noExplicitAny: type casting
//     const jsonSchema = z.toJSONSchema(schema as any)
//     return await convert(jsonSchema)
//   } catch (_) {
//     return null
//   }
// }

const openapiDocument = generateOpenApi(contract, {
  info: {
    title: "TMSU.cc API",
    version: "1.0.0",
    description: "Tommaso Morganti's Short URLs - Service API",
  },
  servers: [{ url: "https://tmsu.cc/api" }],
  components: {
    securitySchemes: {
      CloudflareID: {
        type: "apiKey",
        in: "header",
        name: "CF-Access-Client-Id",
      },
      CloudflareSecret: {
        type: "apiKey",
        in: "header",
        name: "CF-Access-Client-Secret",
      },
    },
  },
})

export async function GET() {
  return new Response(JSON.stringify(openapiDocument), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
