import { describe, expect, it } from "vitest"
import { GET } from "./route"

type Schema = Record<string, unknown> & {
  properties?: Record<string, Schema>
  required?: string[]
}

async function getDocument() {
  const response = await GET()
  return await response.json()
}

function jsonSchema(content: { "application/json": { schema: Schema } }) {
  return content["application/json"].schema
}

describe("GET /openapi.json", () => {
  it("documents request bodies from the Zod schemas", async () => {
    const doc = await getDocument()
    const body = jsonSchema(doc.paths["/urls"].post.requestBody.content)

    expect(body.required).toEqual(["url"])
    expect(body.properties?.url).toEqual({ type: "string", format: "uri" })
    expect(body.properties?.shortCode).toMatchObject({
      type: "string",
      minLength: 2,
      maxLength: 25,
      pattern: "^[a-zA-Z0-9_-]+$",
    })
    expect(body.properties?.aliases).toMatchObject({
      type: "array",
      default: [],
      maxItems: 50,
    })
  })

  it("documents responses as they are serialized", async () => {
    const doc = await getDocument()
    const record = jsonSchema(
      doc.paths["/urls/{shortCode}"].get.responses["200"].content
    )

    expect(record.properties?.created_at).toEqual({
      type: "string",
      format: "date-time",
    })
    expect(record.properties?.last_clicked_at).toMatchObject({
      type: "string",
      format: "date-time",
      nullable: true,
    })
    // response objects stay open so adding a field doesn't break clients
    expect(record).not.toHaveProperty("additionalProperties")
  })

  it("documents query and header parameters", async () => {
    const doc = await getDocument()
    const params: { name: string; in: string; schema: Schema }[] =
      doc.paths["/urls"].get.parameters

    expect(params.map((p) => `${p.in}:${p.name}`)).toEqual([
      "header:authorization",
      "query:page",
      "query:limit",
      "query:search",
      "query:sortBy",
      "query:sortOrder",
      "query:customOnly",
      "query:tag",
    ])
    expect(params.find((p) => p.name === "limit")?.schema).toMatchObject({
      type: "integer",
      default: 10,
      maximum: 100,
    })
  })
})
