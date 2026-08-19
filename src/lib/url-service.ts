import { nanoid } from "nanoid"
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

export class UrlService {
  private pool = getPool()

  async createShortUrl(
    originalUrl: string,
    customShortCode?: string,
    aliases?: string[]
  ): Promise<UrlRecord> {
    let shortCode: string
    let isCustom = true

    if (customShortCode) {
      // Check if custom short code already exists
      const existingUrl = await this.getUrlByShortCode(customShortCode)
      if (existingUrl) {
        throw new Error(
          "Short code already exists. Please choose a different one."
        )
      }
      shortCode = customShortCode
    } else {
      // Generate a unique short code
      shortCode = nanoid(8)
      isCustom = false
    }

    const query = `
      INSERT INTO urls (original_url, short_code, is_custom)
      VALUES ($1, $2, $3)
      RETURNING *
    `

    const result = await this.pool.query(query, [
      originalUrl,
      shortCode,
      isCustom,
    ])
    const urlRecord = result.rows[0]

    for (const alias of aliases ?? []) {
      await this.addAlias(urlRecord.id, alias)
    }

    return this.attachAliases(urlRecord)
  }

  /** Looks up a URL by its primary short_code OR an alias code */
  async getUrlByShortCode(shortCode: string): Promise<UrlRecord | null> {
    const result = await this.pool.query(
      `SELECT u.* FROM urls u
       WHERE u.short_code = $1
          OR u.id = (SELECT url_id FROM url_aliases WHERE alias_code = $1 LIMIT 1)
       LIMIT 1`,
      [shortCode]
    )
    if (!result.rows[0]) return null
    return this.attachAliases(result.rows[0])
  }

  /** Resolve a code (primary or alias) to the destination for a redirect. */
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
    const queryParams = [!search, `%${search}%`, !customOnly, limit, offset]

    const [dataResult, totals] = await Promise.all([
      this.pool.query(
        `
          SELECT * FROM urls
          WHERE ($1 OR (original_url ILIKE $2 OR short_code ILIKE $2)) AND ($3 OR is_custom = TRUE)
          ORDER BY ${sb} ${sortOrder === "asc" ? "ASC" : "DESC"}
          LIMIT $4 OFFSET $5
        `,
        queryParams
      ),
      this.pool.query(
        `
          SELECT COUNT(*) FROM urls
          WHERE ($1 OR (original_url ILIKE $2 OR short_code ILIKE $2)) AND ($3 OR is_custom = TRUE)
        `,
        queryParams.slice(0, 3)
      ),
    ])

    const total = parseInt(totals.rows[0].count, 10)
    const urls = URLRecords.parse(
      await this.attachAliasesToMany(dataResult.rows)
    )

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

  /** Updates the destination URL and reconciles aliases to exactly `aliases` */
  async updateUrl(
    shortCode: string,
    originalUrl: string,
    aliases: string[] = []
  ): Promise<UrlRecord | null> {
    const query = `
      UPDATE urls
      SET original_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE short_code = $2
      RETURNING *
    `

    const result = await this.pool.query(query, [originalUrl, shortCode])
    if (!result.rows[0]) return null

    await this.syncAliases(result.rows[0].id, aliases)

    return this.attachAliases(result.rows[0])
  }

  /** Renames the primary short code, rejecting collisions with any other code. */
  async renameShortCode(
    oldCode: string,
    newCode: string
  ): Promise<UrlRecord | null> {
    if (oldCode === newCode) return this.getUrlByShortCode(oldCode)

    const url = await this.getUrlByShortCode(oldCode)
    if (!url) return null

    if (url.aliases.includes(newCode)) {
      throw new Error(
        `"${newCode}" is already an alias of this URL — use "set as primary" instead of renaming.`
      )
    }

    const conflict = await this.getUrlByShortCode(newCode)
    if (conflict) {
      throw new Error(
        "Short code already exists. Please choose a different one."
      )
    }

    const result = await this.pool.query(
      `UPDATE urls SET short_code = $1, updated_at = CURRENT_TIMESTAMP
       WHERE short_code = $2 RETURNING *`,
      [newCode, oldCode]
    )
    return this.attachAliases(result.rows[0])
  }

  async deleteUrl(shortCode: string): Promise<boolean> {
    const query = "DELETE FROM urls WHERE short_code = $1"
    const result = await this.pool.query(query, [shortCode])
    return (result.rowCount ?? 0) > 0
  }

  /** Atomically increments both the aggregate total and the specific alias hit. */
  async incrementClickCount(shortCode: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(
        `UPDATE urls
         SET click_count = click_count + 1, last_clicked_at = CURRENT_TIMESTAMP
         WHERE short_code = $1
            OR id = (SELECT url_id FROM url_aliases WHERE alias_code = $1 LIMIT 1)`,
        [shortCode]
      )
      await client.query(
        `UPDATE url_aliases
         SET click_count = click_count + 1, last_clicked_at = CURRENT_TIMESTAMP
         WHERE alias_code = $1`,
        [shortCode]
      )
      await client.query("COMMIT")
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  }

  // ── Alias methods ──────────────────────────────────────────────────────────

  async addAlias(urlId: number, aliasCode: string): Promise<void> {
    const existing = await this.getUrlByShortCode(aliasCode)
    if (existing) {
      throw new Error(
        `"${aliasCode}" is already in use as a short code or alias.`
      )
    }
    await this.pool.query(
      "INSERT INTO url_aliases (url_id, alias_code) VALUES ($1, $2)",
      [urlId, aliasCode]
    )
  }

  async removeAlias(urlId: number, aliasCode: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM url_aliases WHERE url_id = $1 AND alias_code = $2",
      [urlId, aliasCode]
    )
    return (result.rowCount ?? 0) > 0
  }

  async getAliasesForUrl(urlId: number): Promise<string[]> {
    const result = await this.pool.query(
      "SELECT alias_code FROM url_aliases WHERE url_id = $1 ORDER BY created_at",
      [urlId]
    )
    return result.rows.map((r: { alias_code: string }) => r.alias_code)
  }

  /**
   * Aggregate `urls.click_count` includes every alias's clicks. "Direct"
   * clicks on the primary code are derived, not stored: total − Σ(alias clicks).
   */
  async getAliasStats(shortCode: string): Promise<AliasStatsResult | null> {
    const url = await this.getUrlByShortCode(shortCode)
    if (!url) return null

    const result = await this.pool.query(
      `SELECT id, url_id, alias_code, click_count, last_clicked_at, created_at
       FROM url_aliases WHERE url_id = $1 ORDER BY created_at`,
      [url.id]
    )
    const aliases = result.rows as AliasRecord[]
    const aliasClicks = aliases.reduce((sum, a) => sum + a.click_count, 0)

    return {
      urlClickCount: Math.max(0, url.click_count - aliasClicks),
      urlLastClickedAt: url.last_clicked_at,
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
        "SELECT short_code, click_count, last_clicked_at FROM urls WHERE id = $1 FOR UPDATE",
        [urlId]
      )
      if (!urlRes.rows[0]) {
        await client.query("ROLLBACK")
        return null
      }
      const oldPrimary: string = urlRes.rows[0].short_code
      const totalClicks: number = urlRes.rows[0].click_count
      const urlLastClickedAt: Date | null = urlRes.rows[0].last_clicked_at

      const aliasRes = await client.query(
        "SELECT id FROM url_aliases WHERE url_id = $1 AND alias_code = $2 FOR UPDATE",
        [urlId, aliasCode]
      )
      if (!aliasRes.rows[0]) {
        await client.query("ROLLBACK")
        return null
      }
      const oldAliasId: number = aliasRes.rows[0].id

      const aliasRowsRes = await client.query(
        "SELECT click_count FROM url_aliases WHERE url_id = $1 FOR UPDATE",
        [urlId]
      )
      const aliasClicks = aliasRowsRes.rows.reduce(
        (total, alias) => total + Number(alias.click_count),
        0
      )
      const directClicks = Math.max(0, Number(totalClicks) - aliasClicks)

      // Demote the current primary: insert it as a new alias, carrying its
      // derived direct-click history.
      await client.query(
        `INSERT INTO url_aliases (url_id, alias_code, click_count, last_clicked_at)
         VALUES ($1, $2, $3, $4)`,
        [urlId, oldPrimary, directClicks, urlLastClickedAt]
      )

      await client.query("DELETE FROM url_aliases WHERE id = $1", [oldAliasId])
      await client.query(
        "UPDATE urls SET short_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [aliasCode, urlId]
      )

      await client.query("COMMIT")
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
    return this.getUrlByShortCode(aliasCode)
  }

  /** Reconciles a URL's aliases to exactly match `aliases` (adds new, removes missing) */
  private async syncAliases(urlId: number, aliases: string[]): Promise<void> {
    const current = new Set(await this.getAliasesForUrl(urlId))
    const next = new Set(aliases.map((a) => a.trim()).filter(Boolean))

    for (const alias of next) {
      if (!current.has(alias)) await this.addAlias(urlId, alias)
    }
    for (const alias of current) {
      if (!next.has(alias)) await this.removeAlias(urlId, alias)
    }
  }

  private async attachAliases(
    row: Record<string, unknown>
  ): Promise<UrlRecord> {
    const aliases = await this.getAliasesForUrl(row.id as number)
    return URLRecord.parse({ ...row, aliases })
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
}

export const urlService = new UrlService()
