import fs from "node:fs"
import path from "node:path"
import { type IMemoryDb, newDb } from "pg-mem"
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

/**
 * Runs init.sql on pg-mem, which has no PL/pgSQL: DO blocks are run here
 * instead, supporting the only shape init.sql uses,
 * `IF NOT EXISTS (<query>) THEN <statement>; END IF;`. Returns the guarded
 * statements that ran.
 */
function runInitSql(db: IMemoryDb, sql: string): string[] {
  const ran: string[] = []
  const parts = sql.split(/DO \$\$([\s\S]*?)\$\$;/)
  parts.forEach((part, i) => {
    if (i % 2 === 0) {
      if (part.trim()) db.public.none(part)
      return
    }
    const guards = part.matchAll(
      /IF NOT EXISTS \(([\s\S]*?)\)\s+THEN([\s\S]*?)END IF;/g
    )
    for (const [, condition, statement] of guards) {
      if (db.public.many(condition).length === 0) {
        db.public.none(statement)
        ran.push(statement.trim())
      }
    }
  })
  return ran
}

describe("init.sql", () => {
  it("upgrades a database created before aliases, keeping its rows", async () => {
    // pg-mem flags the constraints of a CREATE TABLE IF NOT EXISTS that it
    // skips because the table exists; Postgres skips them silently too
    const db = newDb({ noAstCoverageCheck: true })
    db.public.none(PREVIOUS_URLS_SQL)
    db.public.none(
      "INSERT INTO urls (original_url, short_code, click_count) VALUES ('https://example.com', 'abc', 7)"
    )

    expect(runInitSql(db, INIT_SQL)).toHaveLength(3)
    // runs on every start: idempotent, and without ALTER TABLE (and its
    // exclusive lock) once the columns exist
    expect(runInitSql(db, INIT_SQL)).toEqual([])

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
