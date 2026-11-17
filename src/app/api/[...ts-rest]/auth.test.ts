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
    click_count INTEGER DEFAULT 0,
    last_clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
  );

  CREATE TABLE url_aliases (
    id SERIAL PRIMARY KEY,
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    alias_code VARCHAR(25) UNIQUE NOT NULL,
    click_count INTEGER NOT NULL DEFAULT 0,
    last_clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
  return { ...actual, isAuthEnabled: () => true }
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

describe("alias endpoints", () => {
  async function call(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    token?: string,
    body?: unknown
  ) {
    const route = await import("./route")
    const headers: Record<string, string> = {}
    if (token) headers.authorization = `Bearer ${token}`
    if (body !== undefined) headers["content-type"] = "application/json"
    return route[method](
      new NextRequest(`http://localhost/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    )
  }

  async function tokens() {
    const { apiTokenService } = await import("@/lib/api-tokens")
    const admin = await apiTokenService.create(OWNER, "admin key", "admin")
    const viewer = await apiTokenService.create(OWNER, "viewer key", "viewer")
    return { admin: admin.token, viewer: viewer.token }
  }

  beforeEach(async () => {
    await pool.query(
      "INSERT INTO urls (original_url, short_code, is_custom) VALUES ('https://example.com', 'abc', TRUE), ('https://other.com', 'def', TRUE)"
    )
  })

  it("adds, lists, promotes and removes aliases with an admin token", async () => {
    const { admin } = await tokens()

    const added = await call("POST", "/urls/abc/aliases", admin, {
      aliasCode: "wiki",
    })
    expect(added.status).toBe(201)

    const stats = await call("GET", "/urls/abc/alias-stats", admin)
    expect(stats.status).toBe(200)
    expect((await stats.json()).aliases).toMatchObject([{ alias_code: "wiki" }])

    const promoted = await call(
      "POST",
      "/urls/abc/aliases/wiki/promote",
      admin,
      {}
    )
    expect(promoted.status).toBe(200)
    expect(await promoted.json()).toMatchObject({
      short_code: "wiki",
      aliases: ["abc"],
    })

    const removed = await call("DELETE", "/urls/wiki/aliases/abc", admin)
    expect(removed.status).toBe(204)
    const missing = await call("DELETE", "/urls/wiki/aliases/abc", admin)
    expect(missing.status).toBe(404)
  })

  it("rejects invalid and colliding aliases", async () => {
    const { admin } = await tokens()

    const invalid = await call("POST", "/urls/abc/aliases", admin, {
      aliasCode: "not valid!",
    })
    expect(invalid.status).toBe(400)

    const taken = await call("POST", "/urls/abc/aliases", admin, {
      aliasCode: "def",
    })
    expect(taken.status).toBe(400)
    expect((await taken.json()).error).toMatch(/already exists/)

    const viaPut = await call("PUT", "/urls/abc", admin, {
      url: "https://example.com",
      aliases: ["def"],
    })
    expect(viaPut.status).toBe(400)
  })

  it("requires a token, and an admin one to write", async () => {
    const { viewer } = await tokens()

    expect((await call("GET", "/urls/abc/alias-stats")).status).toBe(401)
    expect(
      (await call("POST", "/urls/abc/aliases", undefined, { aliasCode: "x1" }))
        .status
    ).toBe(401)

    expect((await call("GET", "/urls/abc/alias-stats", viewer)).status).toBe(
      200
    )
    expect(
      (await call("POST", "/urls/abc/aliases", viewer, { aliasCode: "x1" }))
        .status
    ).toBe(403)
    expect((await call("DELETE", "/urls/abc/aliases/x1", viewer)).status).toBe(
      403
    )
    expect(
      (await call("POST", "/urls/abc/aliases/x1/promote", viewer, {})).status
    ).toBe(403)
  })

  it("keeps aliases on a PUT that leaves them out, and addresses URLs by primary code", async () => {
    const { admin } = await tokens()
    await call("POST", "/urls/abc/aliases", admin, { aliasCode: "wiki" })

    const updated = await call("PUT", "/urls/abc", admin, {
      url: "https://updated.com",
      tags: ["work"],
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      original_url: "https://updated.com",
      aliases: ["wiki"],
      tags: ["work"],
    })

    expect((await call("GET", "/urls/wiki", admin)).status).toBe(404)
    expect((await call("GET", "/urls/abc", admin)).status).toBe(200)
  })
})
