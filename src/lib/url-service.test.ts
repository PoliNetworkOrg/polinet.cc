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

vi.mock("./db", () => ({
  getPool: () => pool,
}))

async function freshPool() {
  const mem = newDb()
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

  it("creates a URL with tags and lists all distinct tags", async () => {
    const { UrlService } = await import("./url-service")
    const service = new UrlService()

    const record = await service.createShortUrl("https://example.com", "abc", [
      "work",
      "personal",
    ])
    expect(record.tags).toEqual(["personal", "work"])
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
})
