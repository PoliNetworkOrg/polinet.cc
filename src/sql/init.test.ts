import fs from "node:fs"
import path from "node:path"
import { newDb } from "pg-mem"
import { describe, expect, it } from "vitest"

const INIT_SQL = fs.readFileSync(path.join(__dirname, "init.sql"), "utf-8")

// urls as created by init.sql before aliases existed
const PREVIOUS_URLS_SQL = `
  CREATE TABLE urls (
    id SERIAL PRIMARY KEY,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    original_url TEXT NOT NULL,
    short_code VARCHAR(25) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    click_count INTEGER DEFAULT 0
  );
`

describe("init.sql", () => {
  it("upgrades a database created before aliases, keeping its rows", async () => {
    // pg-mem flags the constraints of a CREATE TABLE IF NOT EXISTS that it
    // skips because the table exists; Postgres skips them silently too
    const db = newDb({ noAstCoverageCheck: true })
    db.public.none(PREVIOUS_URLS_SQL)
    db.public.none(
      "INSERT INTO urls (original_url, short_code, click_count) VALUES ('https://example.com', 'abc', 7)"
    )

    db.public.none(INIT_SQL)
    // runs on every start, so it must be idempotent
    db.public.none(INIT_SQL)

    expect(
      db.public.many(
        "SELECT short_code, click_count, last_clicked_at FROM urls"
      )
    ).toEqual([{ short_code: "abc", click_count: 7, last_clicked_at: null }])

    db.public.none(
      "INSERT INTO url_aliases (url_id, alias_code) SELECT id, 'wiki' FROM urls"
    )
    expect(
      db.public.many("SELECT alias_code, click_count FROM url_aliases")
    ).toEqual([{ alias_code: "wiki", click_count: 0 }])
  })
})
