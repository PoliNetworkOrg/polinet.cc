import type { Pool } from "pg"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { newTestDb } from "../test/pg-mem"

const SCHEMA_SQL = `
  CREATE TABLE urls (
    id SERIAL PRIMARY KEY,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    original_url TEXT NOT NULL,
    short_code VARCHAR(25) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    click_count INTEGER DEFAULT 0,
    last_clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    primary_last_clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    removed_alias_click_count INTEGER NOT NULL DEFAULT 0
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
`

let pool: Pool

vi.mock("./db", () => ({
  getPool: () => pool,
}))

async function freshPool() {
  const mem = newTestDb()
  const pg = mem.adapters.createPg()
  const p = new pg.Pool() as unknown as Pool
  await p.query(SCHEMA_SQL)
  return p
}

describe("UrlService", () => {
  beforeEach(async () => {
    pool = await freshPool()
  })

  it("creates a short URL with a random code when none is given", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()

    const record = await service.createShortUrl("https://example.com")

    expect(record.original_url).toBe("https://example.com")
    expect(record.is_custom).toBe(false)
    expect(record.short_code).toHaveLength(8)
  })

  it("creates a short URL with a custom code and rejects a duplicate", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()

    const record = await service.createShortUrl(
      "https://example.com",
      "my-code"
    )
    expect(record.short_code).toBe("my-code")
    expect(record.is_custom).toBe(true)

    await expect(
      service.createShortUrl("https://other.com", "my-code")
    ).rejects.toThrow(/already exists/)
  })

  it("looks up a URL by short code", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc")

    const found = await service.getUrlByShortCode("abc")
    expect(found?.original_url).toBe("https://example.com")

    const missing = await service.getUrlByShortCode("nope")
    expect(missing).toBeNull()
  })

  it("updates the destination URL", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc")

    const updated = await service.updateUrl("abc", "https://updated.com")
    expect(updated?.original_url).toBe("https://updated.com")
  })

  it("deletes a URL", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc")

    expect(await service.deleteUrl("abc")).toBe(true)
    expect(await service.getUrlByShortCode("abc")).toBeNull()
    expect(await service.deleteUrl("abc")).toBe(false)
  })

  it("increments the click count", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc")

    await service.incrementClickCount("abc")
    await service.incrementClickCount("abc")

    const found = await service.getUrlByShortCode("abc")
    expect(found?.click_count).toBe(2)
  })

  it("paginates, searches and sorts results", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com/one", "one")
    await service.createShortUrl("https://example.com/two", "two")
    await service.createShortUrl("https://other.com", "three")

    const bySearch = await service.getAllUrls({ search: "example" })
    expect(bySearch.pagination.total).toBe(2)

    const page1 = await service.getAllUrls({
      limit: 2,
      sortBy: "short_code",
      sortOrder: "asc",
    })
    expect(page1.urls.map((u) => u.short_code)).toEqual(["one", "three"])
    expect(page1.pagination.totalPages).toBe(2)
  })

  it("creates a URL with aliases and resolves them for redirects", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()

    const record = await service.createShortUrl(
      "https://example.com",
      "abc",
      [],
      ["wiki", "docs"]
    )
    expect(record.aliases).toEqual(["wiki", "docs"])

    const viaAlias = await service.resolveClickTarget("wiki")
    expect(viaAlias).toEqual({
      urlId: record.id,
      originalUrl: "https://example.com",
    })
    expect(await service.resolveClickTarget("nope")).toBeNull()
  })

  it("addresses URLs by primary code only outside the redirect", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc", [], ["wiki"])

    // GET, PUT and DELETE /urls/:shortCode must agree on what they address
    expect(await service.getUrlByShortCode("wiki")).toBeNull()
    expect(await service.updateUrl("wiki", "https://other.com")).toBeNull()
    expect(await service.deleteUrl("wiki")).toBe(false)
  })

  it("rejects an alias that collides with an existing short code or alias", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    const a = await service.createShortUrl("https://a.com", "abc", [], ["wiki"])
    await service.createShortUrl("https://b.com", "def")

    await expect(service.addAlias(a.id, "def")).rejects.toThrow(/already/)
    await expect(service.addAlias(a.id, "wiki")).rejects.toThrow(/already/)
  })

  it("rejects a new short code that is already another URL's alias", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://a.com", "abc", [], ["wiki"])

    await expect(
      service.createShortUrl("https://b.com", "wiki")
    ).rejects.toThrow(/already exists/)
    expect((await service.getAllUrls({})).pagination.total).toBe(1)
  })

  it("removes an alias", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    const record = await service.createShortUrl(
      "https://example.com",
      "abc",
      [],
      ["wiki"]
    )

    expect(await service.removeAlias(record.id, "wiki")).toBe(true)
    expect(await service.getAliasesForUrl(record.id)).toEqual([])
  })

  it("reconciles aliases to an explicit list on update", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc", [], ["wiki"])

    const updated = await service.updateUrl("abc", "https://example.com", [], {
      aliases: ["docs"],
    })
    expect(updated?.aliases).toEqual(["docs"])
  })

  it("keeps aliases when an update leaves them out", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc", [], ["wiki"])

    // the pre-alias signature, as API clients written before aliases call it
    const updated = await service.updateUrl("abc", "https://updated.com", [
      "work",
    ])
    expect(updated?.aliases).toEqual(["wiki"])
    expect(updated?.tags).toEqual(["work"])
  })

  it("renames the primary short code, rejecting collisions", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc")
    await service.createShortUrl("https://other.com", "taken", [], ["alias"])

    const renamed = await service.renameShortCode("abc", "xyz")
    expect(renamed?.short_code).toBe("xyz")
    expect(await service.getUrlByShortCode("abc")).toBeNull()

    await expect(service.renameShortCode("xyz", "taken")).rejects.toThrow(
      /already exists/
    )
    await expect(service.renameShortCode("xyz", "alias")).rejects.toThrow(
      /already exists/
    )
    expect(await service.renameShortCode("missing", "other")).toBeNull()
  })

  it("renames and updates in one transaction", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc")
    await service.createShortUrl("https://other.com", "taken")

    const updated = await service.updateUrl("abc", "https://new.com", [], {
      newShortCode: "xyz",
      aliases: ["wiki"],
    })
    expect(updated).toMatchObject({
      short_code: "xyz",
      original_url: "https://new.com",
      aliases: ["wiki"],
    })

    // The alias collides, so the rename must be rolled back with it. pg-mem
    // ignores ROLLBACK, so check that both ran in the same transaction.
    const statements: string[] = []
    const connect = pool.connect.bind(pool)
    vi.spyOn(pool, "connect").mockImplementation((async () => {
      const client = await connect()
      const query = client.query.bind(client) as (...args: unknown[]) => unknown
      client.query = ((sql: string, ...rest: unknown[]) => {
        statements.push(sql.trim().split(/\s+/).slice(0, 3).join(" "))
        return query(sql, ...rest)
      }) as typeof client.query
      return client
    }) as never)

    await expect(
      service.updateUrl("xyz", "https://newer.com", [], {
        newShortCode: "renamed",
        aliases: ["taken"],
      })
    ).rejects.toThrow(/already exists/)
    expect(statements[0]).toBe("BEGIN")
    expect(statements).toContain("UPDATE urls SET")
    expect(statements.at(-1)).toBe("ROLLBACK")
    expect(statements).not.toContain("COMMIT")
  })

  it("suggests promotion when renaming to one of the URL's own aliases", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc", [], ["wiki"])

    await expect(service.renameShortCode("abc", "wiki")).rejects.toThrow(
      /set as primary/
    )
  })

  it("tracks aggregate and per-alias click counts, and derives direct clicks", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    const record = await service.createShortUrl(
      "https://example.com",
      "abc",
      [],
      ["wiki"]
    )

    await service.incrementClickCount("abc")
    await service.incrementClickCount("abc")
    await service.incrementClickCount("wiki")

    const url = await service.getUrlByShortCode("abc")
    expect(url?.click_count).toBe(3)

    const stats = await service.getAliasStats("abc")
    expect(stats?.urlClickCount).toBe(2) // direct clicks = 3 total - 1 alias
    expect(stats?.aliases[0]).toMatchObject({
      alias_code: "wiki",
      click_count: 1,
    })
    expect(record.id).toBe(url?.id)
  })

  it("promotes an alias to become the primary code, preserving click history", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    const record = await service.createShortUrl(
      "https://example.com",
      "abc",
      [],
      ["wiki"]
    )
    await service.incrementClickCount("abc") // 1 direct click on primary
    await service.incrementClickCount("wiki") // 1 click on alias

    const promoted = await service.promoteAlias(record.id, "wiki")
    expect(promoted?.short_code).toBe("wiki")
    expect(promoted?.aliases).toEqual(["abc"])
    expect(promoted?.click_count).toBe(2)

    const stats = await service.getAliasStats("wiki")
    expect(stats?.urlClickCount).toBe(1) // wiki's own direct clicks
    expect(stats?.aliases[0]).toMatchObject({
      alias_code: "abc",
      click_count: 1, // abc's prior direct clicks, carried over
    })
  })

  it("keeps a removed alias's clicks out of the primary code's count", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    const record = await service.createShortUrl(
      "https://example.com",
      "abc",
      [],
      ["wiki", "docs"]
    )
    await service.incrementClickCount("abc")
    await service.incrementClickCount("wiki")
    await service.incrementClickCount("wiki")
    await service.incrementClickCount("docs")

    expect(await service.removeAlias(record.id, "wiki")).toBe(true)
    // reconciling on update removes "docs" the same way
    await service.updateUrl("abc", "https://example.com", [], { aliases: [] })

    const stats = await service.getAliasStats("abc")
    expect(stats).toMatchObject({
      urlClickCount: 1,
      removedAliasClickCount: 3,
      aliases: [],
    })
    expect((await service.getUrlByShortCode("abc"))?.click_count).toBe(4)

    // promoting afterwards must not hand the removed clicks to the old primary
    await service.addAlias(record.id, "new")
    const promoted = await service.promoteAlias(record.id, "new")
    expect(promoted?.short_code).toBe("new")
    const after = await service.getAliasStats("new")
    expect(after?.aliases).toMatchObject([
      { alias_code: "abc", click_count: 1 },
    ])
    expect(after?.urlClickCount).toBe(0)
  })

  it("tracks the primary code's last click apart from its aliases", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    const record = await service.createShortUrl(
      "https://example.com",
      "abc",
      [],
      ["wiki"]
    )

    await service.incrementClickCount("wiki")
    let stats = await service.getAliasStats("abc")
    expect(stats?.urlLastClickedAt).toBeNull()
    expect(stats?.aliases[0].last_clicked_at).not.toBeNull()
    expect(
      (await service.getUrlByShortCode("abc"))?.last_clicked_at
    ).not.toBeNull()

    // promotion swaps the timestamps along with the codes
    await service.promoteAlias(record.id, "wiki")
    stats = await service.getAliasStats("wiki")
    expect(stats?.urlLastClickedAt).not.toBeNull()
    expect(stats?.aliases).toMatchObject([
      { alias_code: "abc", last_clicked_at: null },
    ])
  })

  it("claims an alias under a code lock inside the URL's transaction", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    const record = await service.createShortUrl("https://example.com", "abc")

    const statements: string[] = []
    const connect = pool.connect.bind(pool)
    vi.spyOn(pool, "connect").mockImplementation((async () => {
      const client = await connect()
      const query = client.query.bind(client) as (...args: unknown[]) => unknown
      client.query = ((sql: string, ...rest: unknown[]) => {
        statements.push(sql.trim().split(/\s+/).slice(0, 2).join(" "))
        return query(sql, ...rest)
      }) as typeof client.query
      return client
    }) as never)

    expect(await service.addAlias(record.id, "wiki")).toBe(true)
    expect(statements[0]).toBe("BEGIN")
    const lock = statements.indexOf("SELECT pg_advisory_xact_lock($1,")
    expect(lock).toBeGreaterThan(0)
    expect(statements.indexOf("INSERT INTO")).toBeGreaterThan(lock)
    expect(statements.at(-1)).toBe("COMMIT")

    expect(await service.addAlias(9999, "docs")).toBe(false)
  })

  it("only reports code collisions as CodeConflictError", async () => {
    const { CodeConflictError, UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc", [], ["wiki"])

    await expect(
      service.createShortUrl("https://other.com", "wiki")
    ).rejects.toBeInstanceOf(CodeConflictError)
    await expect(service.renameShortCode("abc", "wiki")).rejects.toBeInstanceOf(
      CodeConflictError
    )
  })

  it("creates a URL with tags and lists all distinct tags", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()

    const record = await service.createShortUrl("https://example.com", "abc", [
      "work",
      "personal",
    ])
    expect(record.tags).toEqual(["personal", "work"])
    expect(record.aliases).toEqual([])
    expect(await service.getAllTags()).toEqual(["personal", "work"])
  })

  it("adds and removes tags from an existing URL", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    const record = await service.createShortUrl("https://example.com", "abc")

    await service.addTag(record.id, "work")
    expect(await service.getTagsForUrl(record.id)).toEqual(["work"])

    expect(await service.removeTag(record.id, "work")).toBe(true)
    expect(await service.getTagsForUrl(record.id)).toEqual([])
  })

  it("reconciles tags to an explicit list on update, including clearing them", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com", "abc", ["work"])

    const updated = await service.updateUrl("abc", "https://example.com", [
      "personal",
    ])
    expect(updated?.tags).toEqual(["personal"])

    const cleared = await service.updateUrl("abc", "https://example.com", [])
    expect(cleared?.tags).toEqual([])
  })

  it("filters URLs by tag", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com/one", "one", ["work"])
    await service.createShortUrl("https://example.com/two", "two", ["personal"])

    const filtered = await service.getAllUrls({ tag: "work" })
    expect(filtered.urls.map((u) => u.short_code)).toEqual(["one"])
  })

  it("finds URLs by alias when searching", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()
    await service.createShortUrl("https://example.com/one", "one", [], ["wiki"])
    await service.createShortUrl("https://example.com/two", "two")

    const found = await service.getAllUrls({ search: "wik" })
    expect(found.urls.map((u) => u.short_code)).toEqual(["one"])
    expect(found.pagination.total).toBe(1)
  })

  it("keeps aliases and tags independent when both are set on the same URL", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()

    const record = await service.createShortUrl(
      "https://example.com",
      "abc",
      ["work"],
      ["wiki"]
    )
    expect(record.aliases).toEqual(["wiki"])
    expect(record.tags).toEqual(["work"])

    const found = await service.getUrlByShortCode("abc")
    expect(found?.aliases).toEqual(["wiki"])
    expect(found?.tags).toEqual(["work"])
  })
})
