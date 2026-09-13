import { NextRequest } from "next/server"
import type { Pool } from "pg"
import { newDb } from "pg-mem"
import { beforeEach, describe, expect, it, vi } from "vitest"

const SCHEMA_SQL = `
  CREATE TABLE urls (
    id SERIAL PRIMARY KEY,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    original_url TEXT NOT NULL,
    short_code VARCHAR(25) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    click_count INTEGER DEFAULT 0
  );

  CREATE TABLE url_tags (
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (url_id, tag_name)
  );

  CREATE TABLE api_tokens (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    token_hash CHAR(64) UNIQUE NOT NULL,
    token_prefix VARCHAR(16) NOT NULL,
    role VARCHAR(10) NOT NULL,
    is_session BOOLEAN NOT NULL DEFAULT FALSE,
    owner_sub VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE
  );
`

let pool: Pool

vi.mock("@/lib/db", () => ({
  getPool: () => pool,
}))

// This deployment has OIDC configured, so the REST API must require a valid
// bearer token; `canRead`/`canWrite` are the real implementations.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, isAuthEnabled: true }
})

const OWNER = { sub: "user-1", name: "Ada Lovelace", email: "ada@example.com" }

beforeEach(async () => {
  vi.resetModules()
  const mem = newDb()
  const pg = mem.adapters.createPg()
  pool = new pg.Pool() as unknown as Pool
  await pool.query(SCHEMA_SQL)
})

describe("REST API bearer token authorization", () => {
  it("rejects a request without an Authorization header", async () => {
    const { GET } = await import("./route")
    const response = await GET(
      new NextRequest("http://localhost/api/urls", { method: "GET" })
    )
    expect(response.status).toBe(401)
  })

  it("rejects a request with a garbage token", async () => {
    const { GET } = await import("./route")
    const response = await GET(
      new NextRequest("http://localhost/api/urls", {
        method: "GET",
        headers: { authorization: "Bearer not-a-real-token" },
      })
    )
    expect(response.status).toBe(401)
  })

  it("lets a viewer token read but not create URLs", async () => {
    const { apiTokenService } = await import("@/lib/api-tokens")
    const { token } = await apiTokenService.create(
      OWNER,
      "viewer key",
      "viewer"
    )

    const { GET, POST } = await import("./route")

    const readResponse = await GET(
      new NextRequest("http://localhost/api/urls", {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      })
    )
    expect(readResponse.status).toBe(200)

    const writeResponse = await POST(
      new NextRequest("http://localhost/api/urls", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    )
    expect(writeResponse.status).toBe(403)
  })

  it("lets an admin token create URLs", async () => {
    const { apiTokenService } = await import("@/lib/api-tokens")
    const { token } = await apiTokenService.create(OWNER, "admin key", "admin")

    const { POST } = await import("./route")
    const response = await POST(
      new NextRequest("http://localhost/api/urls", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    )
    expect(response.status).toBe(201)
  })
})
