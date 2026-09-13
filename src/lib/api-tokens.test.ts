import type { Pool } from "pg"
import { newDb } from "pg-mem"
import { beforeEach, describe, expect, it, vi } from "vitest"

const SCHEMA_SQL = `
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

const OWNER = { sub: "user-1", name: "Ada Lovelace", email: "ada@example.com" }
const OTHER_OWNER = { sub: "user-2", name: "Bob", email: "bob@example.com" }

let pool: Pool

vi.mock("@/lib/db", () => ({
  getPool: () => pool,
}))

beforeEach(async () => {
  vi.resetModules()
  const mem = newDb()
  const pg = mem.adapters.createPg()
  pool = new pg.Pool() as unknown as Pool
  await pool.query(SCHEMA_SQL)
})

describe("ApiTokenService", () => {
  it("creates a token whose raw value verifies back to its owner and role", async () => {
    const { apiTokenService } = await import("./api-tokens")
    const { token, record } = await apiTokenService.create(
      OWNER,
      "CI key",
      "admin"
    )

    expect(token).toMatch(/^pn_/)
    expect(record.name).toBe("CI key")
    expect(record.role).toBe("admin")
    expect(record.tokenPrefix).toBe(token.slice(0, 9))
    expect(record.lastUsedAt).toBeNull()

    const auth = await apiTokenService.verify(token)
    expect(auth).toEqual({
      tokenId: record.id,
      role: "admin",
      ownerSub: OWNER.sub,
    })
  })

  it("rejects an unknown or malformed token", async () => {
    const { apiTokenService } = await import("./api-tokens")
    await apiTokenService.create(OWNER, "CI key", "admin")

    expect(await apiTokenService.verify("pn_not-a-real-token")).toBeNull()
  })

  it("lists only a user's own personal tokens, newest first", async () => {
    const { apiTokenService } = await import("./api-tokens")
    await apiTokenService.create(OWNER, "First", "viewer")
    await apiTokenService.create(OWNER, "Second", "admin")
    await apiTokenService.create(OTHER_OWNER, "Someone else's", "admin")
    await apiTokenService.mintSessionToken(OWNER, "admin")

    const tokens = await apiTokenService.list(OWNER.sub)

    expect(tokens.map((t) => t.name)).toEqual(["Second", "First"])
  })

  it("only revokes a token that belongs to its owner", async () => {
    const { apiTokenService } = await import("./api-tokens")
    const { record } = await apiTokenService.create(OWNER, "CI key", "admin")

    expect(await apiTokenService.revoke(record.id, OTHER_OWNER.sub)).toBe(false)
    expect(await apiTokenService.revoke(record.id, OWNER.sub)).toBe(true)
    expect(await apiTokenService.list(OWNER.sub)).toEqual([])
  })

  it("never lets a session token be revoked as a personal one", async () => {
    const { apiTokenService } = await import("./api-tokens")
    await apiTokenService.mintSessionToken(OWNER, "admin")
    const [{ id }] = (
      await pool.query("SELECT id FROM api_tokens WHERE owner_sub = $1", [
        OWNER.sub,
      ])
    ).rows

    expect(await apiTokenService.revoke(id, OWNER.sub)).toBe(false)
  })

  it("replaces a user's session token instead of accumulating them", async () => {
    const { apiTokenService } = await import("./api-tokens")
    const first = await apiTokenService.mintSessionToken(OWNER, "viewer")
    const second = await apiTokenService.mintSessionToken(OWNER, "admin")

    expect(await apiTokenService.verify(first)).toBeNull()
    expect((await apiTokenService.verify(second))?.role).toBe("admin")

    const { rows } = await pool.query(
      "SELECT COUNT(*) FROM api_tokens WHERE owner_sub = $1 AND is_session = TRUE",
      [OWNER.sub]
    )
    expect(Number(rows[0].count)).toBe(1)
  })

  it("revokes a user's session token on demand (e.g. on logout)", async () => {
    const { apiTokenService } = await import("./api-tokens")
    const token = await apiTokenService.mintSessionToken(OWNER, "admin")

    await apiTokenService.revokeSessionToken(OWNER.sub)

    expect(await apiTokenService.verify(token)).toBeNull()
  })
})

describe("parseBearerToken", () => {
  it("extracts the token from a well-formed header", async () => {
    const { parseBearerToken } = await import("./api-tokens")
    expect(parseBearerToken("Bearer pn_abc123")).toBe("pn_abc123")
    expect(parseBearerToken("bearer pn_abc123")).toBe("pn_abc123")
  })

  it("returns null for a missing or malformed header", async () => {
    const { parseBearerToken } = await import("./api-tokens")
    expect(parseBearerToken(undefined)).toBeNull()
    expect(parseBearerToken(null)).toBeNull()
    expect(parseBearerToken("")).toBeNull()
    expect(parseBearerToken("pn_abc123")).toBeNull()
    expect(parseBearerToken("Basic dXNlcjpwYXNz")).toBeNull()
  })
})
