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
`

let pool: Pool

vi.mock("@/lib/db", () => ({
  getPool: () => pool,
}))

describe("DELETE /api/urls/:shortCode/tags/:tagName", () => {
  beforeEach(async () => {
    vi.resetModules()
    const mem = newDb()
    const pg = mem.adapters.createPg()
    pool = new pg.Pool() as unknown as Pool
    await pool.query(SCHEMA_SQL)
    await pool.query(
      `
        INSERT INTO urls (original_url, short_code, is_custom)
        VALUES ('https://example.com', 'abc', TRUE);
        INSERT INTO url_tags (url_id, tag_name)
        SELECT id, 'a/b' FROM urls WHERE short_code = 'abc';
      `
    )
  })

  it("removes a tag whose encoded name contains a slash", async () => {
    const { DELETE } = await import("./route")
    const request = new NextRequest(
      "http://localhost/api/urls/abc/tags/a%2Fb",
      { method: "DELETE" }
    )

    const response = await DELETE(request)

    expect(response.status).toBe(204)
    const remainingTags = await pool.query(
      "SELECT tag_name FROM url_tags ORDER BY tag_name"
    )
    expect(remainingTags.rows).toEqual([])
  })
})
