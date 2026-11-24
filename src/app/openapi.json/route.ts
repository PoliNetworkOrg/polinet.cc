import { generateOpenApi, type SchemaTransformerSync } from "@ts-rest/open-api"
import { z } from "zod"
import { env } from "@/env"
import { contract } from "@/lib/contract"

type SchemaObject = NonNullable<ReturnType<SchemaTransformerSync>>

// ts-rest's default transformer only understands Zod 3, so the contract's
// Zod 4 schemas are converted with Zod's own JSON Schema generator instead.
const zodSchemaTransformer: SchemaTransformerSync = ({ schema, type }) => {
  if (!(schema instanceof z.ZodType)) return null

  const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    // requests are documented as clients send them, responses as they arrive
    io: type === "response" ? "output" : "input",
    // z.void() (empty responses) and dates have no JSON Schema equivalent
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      // dates are serialized to ISO strings in JSON
      if (zodSchema._zod.def.type === "date") {
        jsonSchema.type = "string"
        jsonSchema.format = "date-time"
      }
      // Zod closes output objects, which would make strict clients reject
      // responses as soon as a field is added: keep them open as before
      if (jsonSchema.additionalProperties === false) {
        delete jsonSchema.additionalProperties
      }
    },
  })
  return jsonSchema as SchemaObject
}

const openapiDocument = generateOpenApi(
  contract,
  {
    info: {
      title: `${env.DOMAIN} API`,
      version: "1.0.0",
      description: "PoliNetwork's Short URLs - Service API",
    },
    servers: [{ url: `https://${env.DOMAIN}/api` }],
    security: [{ BearerAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "Personal API token, created from the /admin dashboard's account menu. Send as `Authorization: Bearer <token>`.",
        },
      },
    },
  },
  { schemaTransformer: zodSchemaTransformer }
)

export async function GET() {
  return new Response(JSON.stringify(openapiDocument), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
