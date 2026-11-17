import { nanoid } from "nanoid"
import type { PoolClient } from "pg"
import { getPool } from "./db"
import {
  type AliasRecord,
  type AliasStatsResult,
  type GetUrlsQueryParams,
  type PaginatedUrlsResponse,
  URLRecord,
  URLRecords,
  type UrlRecord,
} from "./schemas"

type QueryClient = Pick<PoolClient, "query">

/** A code is already taken: the only service error that is the caller's fault. */
export class CodeConflictError extends Error {
  name = "CodeConflictError"
}

// pg_advisory_xact_lock(int4, int4): the first key keeps these locks apart
// from any other advisory lock on the database
const CODE_LOCK_CLASS = 0x706e6363 // "pncc"

/** 32-bit FNV-1a of the code, as a signed int4 for the advisory lock key. */
function codeLockKey(code: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < code.length; i++) {
    hash ^= code.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash | 0
}

/*
 * Lock order, to keep concurrent writers from deadlocking: the urls row
 * (FOR UPDATE) first, then code locks (sorted), then url_aliases rows.
 */

export class UrlService {
  private pool = getPool()

  async createShortUrl(
    originalUrl: string,
    customShortCode?: string,
    tags?: string[],
    aliases?: string[]
  ): Promise<UrlRecord> {
    const client = await this.pool.connect()

    try {
      await client.query("BEGIN")

      let shortCode: string
      let isCustom = true

      if (customShortCode) {
        shortCode = customShortCode
      } else {
        shortCode = nanoid(8)
        isCustom = false
      }
      await this.lockCodes(client, [shortCode, ...(aliases ?? [])])
      // also for a random code: urls.short_code is UNIQUE, but nothing in the
      // database stops it from matching an existing alias
      await this.assertCodeAvailable(client, shortCode)

      const result = await client.query(
        `
          INSERT INTO urls (original_url, short_code, is_custom)
          VALUES ($1, $2, $3)
          RETURNING *
        `,
        [originalUrl, shortCode, isCustom]
      )
      const urlRecord = result.rows[0]

      await this.syncTags(client, urlRecord.id, tags ?? [])
      await this.syncAliases(client, urlRecord.id, aliases ?? [])
      const fullRecord = await this.attachAll(client, urlRecord)

      await client.query("COMMIT")
      return fullRecord
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Looks up a URL by its primary short code only. The API and the dashboard
   * address URLs by primary code, so that GET, PUT and DELETE agree on which
   * record `/urls/:shortCode` is; aliases only resolve in the redirect
   * (`resolveClickTarget`).
   */
  async getUrlByShortCode(shortCode: string): Promise<UrlRecord | null> {
    const result = await this.pool.query(
      "SELECT * FROM urls WHERE short_code = $1",
      [shortCode]
    )
    if (!result.rows[0]) return null
    return this.attachAll(this.pool, result.rows[0])
  }

  /**
   * Resolves a code (primary or alias) to the destination for a redirect.
   * Aliases are root-level codes only: when namespaces land (#45) this must
   * keep matching root URLs only.
   */
  async resolveClickTarget(
    code: string
  ): Promise<{ urlId: number; originalUrl: string } | null> {
    const result = await this.pool.query(
      `SELECT u.id, u.original_url FROM urls u
       WHERE u.short_code = $1
          OR u.id = (SELECT url_id FROM url_aliases WHERE alias_code = $1 LIMIT 1)
       LIMIT 1`,
      [code]
    )
    const row = result.rows[0]
    if (!row) return null
    return { urlId: row.id, originalUrl: row.original_url }
  }

  async getAllUrls(
    options: Partial<GetUrlsQueryParams>
  ): Promise<PaginatedUrlsResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "created_at",
      customOnly = false,
      sortOrder = "desc",
      tag,
    } = options

    const sb = [
      "created_at",
      "updated_at",
      "click_count",
      "short_code",
    ].includes(sortBy)
      ? sortBy
      : "created_at"

    const offset = (page - 1) * limit
    // $1 = no-search flag, $2 = search pattern,
    // $3 = no-customOnly flag, $4 = tag filter (null = all), $5 = limit, $6 = offset
    const queryParams = [
      !search,
      `%${search}%`,
      !customOnly,
      tag ?? null,
      limit,
      offset,
    ]

    // Filtering by tag uses a plain LEFT JOIN restricted to the requested tag
    // name (not a correlated subquery), since (url_id, tag_name) is unique so
    // it can't multiply rows.
    const fromAndWhere = `
      FROM urls u
      LEFT JOIN url_tags mt ON mt.url_id = u.id AND mt.tag_name = $4
      WHERE ($1 OR (
          u.original_url ILIKE $2
          OR u.short_code ILIKE $2
          OR u.id IN (
            SELECT url_id FROM url_aliases WHERE alias_code ILIKE $2
          )
        ))
        AND ($3 OR u.is_custom = TRUE)
        AND ($4::text IS NULL OR mt.tag_name IS NOT NULL)
    `

    const [dataResult, totals] = await Promise.all([
      this.pool.query(
        `
          SELECT u.* ${fromAndWhere}
          ORDER BY ${sb} ${sortOrder === "asc" ? "ASC" : "DESC"}
          LIMIT $5 OFFSET $6
        `,
        queryParams
      ),
      this.pool.query(
        `SELECT COUNT(*) ${fromAndWhere}`,
        queryParams.slice(0, 4)
      ),
    ])

    const total = parseInt(totals.rows[0].count, 10)
    const urls = URLRecords.parse(await this.attachAllToMany(dataResult.rows))

    return {
      urls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Updates the destination URL and reconciles tags to exactly match `tags`.
   * `aliases` is reconciled the same way when given and left untouched when
   * omitted, so API clients that predate aliases don't wipe them. A
   * `newShortCode` renames the primary code in the same transaction.
   */
  async updateUrl(
    shortCode: string,
    originalUrl: string,
    tags: string[] = [],
    options: { aliases?: string[]; newShortCode?: string } = {}
  ): Promise<UrlRecord | null> {
    const client = await this.pool.connect()

    try {
      await client.query("BEGIN")

      const lockedUrl = await client.query(
        "SELECT id FROM urls WHERE short_code = $1 FOR UPDATE",
        [shortCode]
      )
      if (!lockedUrl.rows[0]) {
        await client.query("COMMIT")
        return null
      }
      const urlId: number = lockedUrl.rows[0].id

      await this.lockCodes(client, [
        ...(options.newShortCode ? [options.newShortCode] : []),
        ...(options.aliases ?? []),
      ])
      if (options.newShortCode && options.newShortCode !== shortCode) {
        await this.renameWithClient(client, urlId, options.newShortCode)
      }

      const result = await client.query(
        `
          UPDATE urls
          SET original_url = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `,
        [originalUrl, urlId]
      )

      await this.syncTags(client, urlId, tags)
      if (options.aliases) {
        await this.syncAliases(client, urlId, options.aliases)
      }
      const fullRecord = await this.attachAll(client, result.rows[0])

      await client.query("COMMIT")
      return fullRecord
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  /** Renames the primary short code, rejecting collisions with any other code. */
  async renameShortCode(
    oldCode: string,
    newCode: string
  ): Promise<UrlRecord | null> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      const locked = await client.query(
        "SELECT id FROM urls WHERE short_code = $1 FOR UPDATE",
        [oldCode]
      )
      if (!locked.rows[0]) {
        await client.query("ROLLBACK")
        return null
      }
      const urlId: number = locked.rows[0].id
      if (oldCode !== newCode) {
        await this.renameWithClient(client, urlId, newCode)
      }
      const result = await client.query("SELECT * FROM urls WHERE id = $1", [
        urlId,
      ])
      const record = await this.attachAll(client, result.rows[0])
      await client.query("COMMIT")
      return record
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  private async renameWithClient(
    client: QueryClient,
    urlId: number,
    newCode: string
  ): Promise<void> {
    const ownAlias = await client.query(
      "SELECT 1 FROM url_aliases WHERE url_id = $1 AND alias_code = $2",
      [urlId, newCode]
    )
    if (ownAlias.rows[0]) {
      throw new CodeConflictError(
        `"${newCode}" is already an alias of this URL — use "set as primary" instead of renaming.`
      )
    }
    await this.assertCodeAvailable(client, newCode)
    await client.query(
      `UPDATE urls SET short_code = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newCode, urlId]
    )
  }

  /**
   * Takes a transaction-scoped lock per code, in a fixed order. Paths that
   * claim several codes take them all upfront, so two transactions claiming
   * the same codes can't deadlock.
   */
  private async lockCodes(client: QueryClient, codes: string[]) {
    const keys = [...new Set(codes.map((c) => c.trim()).filter(Boolean))]
      .map(codeLockKey)
      .sort((a, b) => a - b)
    for (const key of new Set(keys)) {
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
        CODE_LOCK_CLASS,
        key,
      ])
    }
  }

  /**
   * Throws a CodeConflictError when `code` is already a primary short code or
   * an alias. Every root-level code (new URL, alias, rename) is claimed
   * through here, so this is where namespace scoping and reserved names (#45)
   * belong.
   *
   * The two tables can't share a UNIQUE constraint, so the check holds a lock
   * on the code until the transaction ends: it must run inside the
   * transaction that writes the code.
   */
  private async assertCodeAvailable(
    client: QueryClient,
    code: string
  ): Promise<void> {
    await this.lockCodes(client, [code])
    const existing = await client.query(
      `SELECT 1 FROM urls WHERE short_code = $1
       UNION ALL
       SELECT 1 FROM url_aliases WHERE alias_code = $1
       LIMIT 1`,
      [code]
    )
    if (existing.rows[0]) {
      throw new CodeConflictError(
        `Short code "${code}" already exists as a short code or alias. Please choose a different one.`
      )
    }
  }

  async deleteUrl(shortCode: string): Promise<boolean> {
    const query = "DELETE FROM urls WHERE short_code = $1"
    const result = await this.pool.query(query, [shortCode])
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Counts a click on `code`: the URL's total always, plus the alias's own
   * counter or the primary code's last-click time. The alias is re-checked
   * under lock so both counters land on the same URL even if it is removed
   * or promoted meanwhile.
   */
  async incrementClickCount(code: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      const alias = await client.query(
        "SELECT url_id FROM url_aliases WHERE alias_code = $1",
        [code]
      )
      if (alias.rows[0]) {
        const urlId: number = alias.rows[0].url_id
        await client.query("SELECT 1 FROM urls WHERE id = $1 FOR UPDATE", [
          urlId,
        ])
        const counted = await client.query(
          `UPDATE url_aliases
           SET click_count = click_count + 1, last_clicked_at = CURRENT_TIMESTAMP
           WHERE alias_code = $1 AND url_id = $2`,
          [code, urlId]
        )
        if ((counted.rowCount ?? 0) > 0) {
          await client.query(
            `UPDATE urls
             SET click_count = click_count + 1, last_clicked_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [urlId]
          )
        }
      } else {
        await client.query(
          `UPDATE urls
           SET click_count = click_count + 1,
               last_clicked_at = CURRENT_TIMESTAMP,
               primary_last_clicked_at = CURRENT_TIMESTAMP
           WHERE short_code = $1`,
          [code]
        )
      }
      await client.query("COMMIT")
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  }

  // ── Alias methods ──────────────────────────────────────────────────────────

  /** Returns false when the URL doesn't exist. */
  async addAlias(urlId: number, aliasCode: string): Promise<boolean> {
    return this.inUrlTransaction(urlId, async (client) => {
      await this.addAliasWithClient(client, urlId, aliasCode)
      return true
    })
  }

  async removeAlias(urlId: number, aliasCode: string): Promise<boolean> {
    return this.inUrlTransaction(urlId, (client) =>
      this.removeAliasWithClient(client, urlId, aliasCode)
    )
  }

  /** Runs `fn` in a transaction holding the URL's row lock; false if missing. */
  private async inUrlTransaction(
    urlId: number,
    fn: (client: PoolClient) => Promise<boolean>
  ): Promise<boolean> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      const locked = await client.query(
        "SELECT 1 FROM urls WHERE id = $1 FOR UPDATE",
        [urlId]
      )
      const result = locked.rows[0] ? await fn(client) : false
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  async getAliasesForUrl(urlId: number): Promise<string[]> {
    return this.getAliasesForUrlWithClient(this.pool, urlId)
  }

  /**
   * `urls.click_count` is the total over every route, including aliases that
   * were removed since (`removed_alias_click_count`). Clicks on the primary
   * code are derived from those: total - aliases - removed aliases. One
   * statement, so all counters come from the same snapshot.
   */
  async getAliasStats(shortCode: string): Promise<AliasStatsResult | null> {
    const result = await this.pool.query(
      `SELECT u.click_count, u.primary_last_clicked_at,
              u.removed_alias_click_count,
              a.id AS alias_id, a.url_id AS alias_url_id, a.alias_code,
              a.click_count AS alias_click_count,
              a.last_clicked_at AS alias_last_clicked_at,
              a.created_at AS alias_created_at
       FROM urls u
       LEFT JOIN url_aliases a ON a.url_id = u.id
       WHERE u.short_code = $1
       ORDER BY a.created_at`,
      [shortCode]
    )
    const first = result.rows[0]
    if (!first) return null

    const aliases: AliasRecord[] = result.rows
      .filter((row) => row.alias_id !== null)
      .map((row) => ({
        id: row.alias_id,
        url_id: row.alias_url_id,
        alias_code: row.alias_code,
        click_count: row.alias_click_count,
        last_clicked_at: row.alias_last_clicked_at,
        created_at: row.alias_created_at,
      }))
    const aliasClicks = aliases.reduce((sum, a) => sum + a.click_count, 0)
    const removedAliasClickCount = Number(first.removed_alias_click_count)

    return {
      urlClickCount: Math.max(
        0,
        first.click_count - aliasClicks - removedAliasClickCount
      ),
      urlLastClickedAt: first.primary_last_clicked_at,
      removedAliasClickCount,
      aliases,
    }
  }

  /**
   * Swaps an alias and the primary short code: the alias becomes `short_code`
   * on `urls`, and the former primary code becomes a new alias, carrying over
   * its derived direct-click count and last-click time.
   */
  async promoteAlias(
    urlId: number,
    aliasCode: string
  ): Promise<UrlRecord | null> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")

      const urlRes = await client.query(
        `SELECT short_code, click_count, primary_last_clicked_at,
                removed_alias_click_count
         FROM urls WHERE id = $1 FOR UPDATE`,
        [urlId]
      )
      if (!urlRes.rows[0]) {
        await client.query("ROLLBACK")
        return null
      }
      const oldPrimary: string = urlRes.rows[0].short_code
      const totalClicks: number = urlRes.rows[0].click_count
      const removedClicks = Number(urlRes.rows[0].removed_alias_click_count)
      const primaryLastClickedAt: Date | null =
        urlRes.rows[0].primary_last_clicked_at

      const aliasRes = await client.query(
        "SELECT id, last_clicked_at FROM url_aliases WHERE url_id = $1 AND alias_code = $2 FOR UPDATE",
        [urlId, aliasCode]
      )
      if (!aliasRes.rows[0]) {
        await client.query("ROLLBACK")
        return null
      }
      const oldAliasId: number = aliasRes.rows[0].id
      const aliasLastClickedAt: Date | null = aliasRes.rows[0].last_clicked_at

      const aliasRowsRes = await client.query(
        "SELECT click_count FROM url_aliases WHERE url_id = $1 FOR UPDATE",
        [urlId]
      )
      const aliasClicks = aliasRowsRes.rows.reduce(
        (total, alias) => total + Number(alias.click_count),
        0
      )
      const directClicks = Math.max(
        0,
        Number(totalClicks) - aliasClicks - removedClicks
      )

      // Demote the current primary: insert it as a new alias, carrying its
      // derived direct-click history and last-click time. The promoted
      // alias's clicks become the primary's once its row is gone.
      await client.query(
        `INSERT INTO url_aliases (url_id, alias_code, click_count, last_clicked_at)
         VALUES ($1, $2, $3, $4)`,
        [urlId, oldPrimary, directClicks, primaryLastClickedAt]
      )

      await client.query("DELETE FROM url_aliases WHERE id = $1", [oldAliasId])
      const updated = await client.query(
        `UPDATE urls
         SET short_code = $1, primary_last_clicked_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [aliasCode, aliasLastClickedAt, urlId]
      )
      const record = await this.attachAll(client, updated.rows[0])

      await client.query("COMMIT")
      return record
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  }

  /** Reconciles a URL's aliases to exactly match `aliases` (adds new, removes missing) */
  private async syncAliases(
    client: QueryClient,
    urlId: number,
    aliases: string[]
  ): Promise<void> {
    const current = new Set(
      await this.getAliasesForUrlWithClient(client, urlId)
    )
    const next = new Set(aliases.map((a) => a.trim()).filter(Boolean))

    for (const alias of next) {
      if (!current.has(alias)) {
        await this.addAliasWithClient(client, urlId, alias)
      }
    }
    for (const alias of current) {
      if (!next.has(alias)) {
        await this.removeAliasWithClient(client, urlId, alias)
      }
    }
  }

  private async addAliasWithClient(
    client: QueryClient,
    urlId: number,
    aliasCode: string
  ): Promise<void> {
    await this.assertCodeAvailable(client, aliasCode)
    await client.query(
      "INSERT INTO url_aliases (url_id, alias_code) VALUES ($1, $2)",
      [urlId, aliasCode]
    )
  }

  /**
   * Its clicks stay in `urls.click_count` and move to
   * `removed_alias_click_count`, so they aren't counted as the primary's.
   * Callers must hold the URL's row lock.
   */
  private async removeAliasWithClient(
    client: QueryClient,
    urlId: number,
    aliasCode: string
  ): Promise<boolean> {
    const result = await client.query(
      "DELETE FROM url_aliases WHERE url_id = $1 AND alias_code = $2 RETURNING click_count",
      [urlId, aliasCode]
    )
    const removed = result.rows[0]
    if (!removed) return false
    await client.query(
      `UPDATE urls SET removed_alias_click_count = removed_alias_click_count + $1
       WHERE id = $2`,
      [removed.click_count, urlId]
    )
    return true
  }

  private async getAliasesForUrlWithClient(
    client: QueryClient,
    urlId: number
  ): Promise<string[]> {
    const result = await client.query(
      "SELECT alias_code FROM url_aliases WHERE url_id = $1 ORDER BY created_at",
      [urlId]
    )
    return result.rows.map((r: { alias_code: string }) => r.alias_code)
  }

  /** Batch-fetches aliases for many rows in one query instead of one-per-row */
  private async attachAliasesToMany(
    rows: Record<string, unknown>[]
  ): Promise<Record<string, unknown>[]> {
    if (rows.length === 0) return rows

    const ids = rows.map((r) => r.id as number)
    const result = await this.pool.query(
      "SELECT url_id, alias_code FROM url_aliases WHERE url_id = ANY($1::int[]) ORDER BY created_at",
      [ids]
    )
    const aliasesByUrlId = new Map<number, string[]>()
    for (const { url_id, alias_code } of result.rows as {
      url_id: number
      alias_code: string
    }[]) {
      const list = aliasesByUrlId.get(url_id) ?? []
      list.push(alias_code)
      aliasesByUrlId.set(url_id, list)
    }

    return rows.map((row) => ({
      ...row,
      aliases: aliasesByUrlId.get(row.id as number) ?? [],
    }))
  }

  /** Returns all distinct tag names in use, sorted */
  async getAllTags(): Promise<string[]> {
    const result = await this.pool.query(
      "SELECT DISTINCT tag_name FROM url_tags ORDER BY tag_name"
    )
    return result.rows.map((r: { tag_name: string }) => r.tag_name)
  }

  async addTag(urlId: number, tagName: string): Promise<void> {
    await this.addTagWithClient(this.pool, urlId, tagName)
  }

  async removeTag(urlId: number, tagName: string): Promise<boolean> {
    return this.removeTagWithClient(this.pool, urlId, tagName)
  }

  async getTagsForUrl(urlId: number): Promise<string[]> {
    return this.getTagsForUrlWithClient(this.pool, urlId)
  }

  /** Reconciles a URL's tags to exactly match `tags` (adds new, removes missing) */
  private async syncTags(
    client: PoolClient,
    urlId: number,
    tags: string[]
  ): Promise<void> {
    const current = new Set(await this.getTagsForUrlWithClient(client, urlId))
    const next = new Set(tags.map((t) => t.trim()).filter(Boolean))

    for (const tag of next) {
      if (!current.has(tag)) await this.addTagWithClient(client, urlId, tag)
    }
    for (const tag of current) {
      if (!next.has(tag)) await this.removeTagWithClient(client, urlId, tag)
    }
  }

  private async addTagWithClient(
    client: QueryClient,
    urlId: number,
    tagName: string
  ): Promise<void> {
    await client.query(
      "INSERT INTO url_tags (url_id, tag_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [urlId, tagName.trim()]
    )
  }

  private async removeTagWithClient(
    client: QueryClient,
    urlId: number,
    tagName: string
  ): Promise<boolean> {
    const result = await client.query(
      "DELETE FROM url_tags WHERE url_id = $1 AND tag_name = $2",
      [urlId, tagName]
    )
    return (result.rowCount ?? 0) > 0
  }

  private async getTagsForUrlWithClient(
    client: QueryClient,
    urlId: number
  ): Promise<string[]> {
    const result = await client.query(
      "SELECT tag_name FROM url_tags WHERE url_id = $1 ORDER BY tag_name",
      [urlId]
    )
    return result.rows.map((r: { tag_name: string }) => r.tag_name)
  }

  /** Batch-fetches tags for many rows in one query instead of one-per-row */
  private async attachTagsToMany(
    rows: Record<string, unknown>[]
  ): Promise<Record<string, unknown>[]> {
    if (rows.length === 0) return rows

    const ids = rows.map((r) => r.id as number)
    const result = await this.pool.query(
      "SELECT url_id, tag_name FROM url_tags WHERE url_id = ANY($1::int[]) ORDER BY tag_name",
      [ids]
    )
    const tagsByUrlId = new Map<number, string[]>()
    for (const { url_id, tag_name } of result.rows as {
      url_id: number
      tag_name: string
    }[]) {
      const list = tagsByUrlId.get(url_id) ?? []
      list.push(tag_name)
      tagsByUrlId.set(url_id, list)
    }

    return rows.map((row) => ({
      ...row,
      tags: tagsByUrlId.get(row.id as number) ?? [],
    }))
  }

  /** Attaches both aliases and tags to a single row within a transaction/connection */
  private async attachAll(
    client: QueryClient,
    row: Record<string, unknown>
  ): Promise<UrlRecord> {
    const [aliases, tags] = await Promise.all([
      this.getAliasesForUrlWithClient(client, row.id as number),
      this.getTagsForUrlWithClient(client, row.id as number),
    ])
    return URLRecord.parse({ ...row, aliases, tags })
  }

  /** Attaches both aliases and tags to many rows, batching each */
  private async attachAllToMany(
    rows: Record<string, unknown>[]
  ): Promise<Record<string, unknown>[]> {
    if (rows.length === 0) return rows
    const withAliases = await this.attachAliasesToMany(rows)
    return this.attachTagsToMany(withAliases)
  }
}

export const urlService = new UrlService()
