import { nanoid } from "nanoid"
import { getPool } from "./db"
import {
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
    tags?: string[]
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

    for (const tag of tags ?? []) {
      await this.addTag(urlRecord.id, tag)
    }

    return this.attachTags(urlRecord)
  }

  async getUrlByShortCode(shortCode: string): Promise<UrlRecord | null> {
    const query = "SELECT * FROM urls WHERE short_code = $1"
    const result = await this.pool.query(query, [shortCode])
    if (!result.rows[0]) return null
    return this.attachTags(result.rows[0])
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
      WHERE ($1 OR (u.original_url ILIKE $2 OR u.short_code ILIKE $2))
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
    const urls = URLRecords.parse(await this.attachTagsToMany(dataResult.rows))

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

  async updateUrl(
    shortCode: string,
    originalUrl: string,
    tags: string[] = []
  ): Promise<UrlRecord | null> {
    const query = `
      UPDATE urls
      SET original_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE short_code = $2
      RETURNING *
    `

    const result = await this.pool.query(query, [originalUrl, shortCode])
    if (!result.rows[0]) return null

    await this.syncTags(result.rows[0].id, tags)

    return this.attachTags(result.rows[0])
  }

  async deleteUrl(shortCode: string): Promise<boolean> {
    const query = "DELETE FROM urls WHERE short_code = $1"
    const result = await this.pool.query(query, [shortCode])
    return (result.rowCount ?? 0) > 0
  }

  async incrementClickCount(shortCode: string): Promise<void> {
    const query = `
      UPDATE urls
      SET click_count = click_count + 1
      WHERE short_code = $1
    `

    await this.pool.query(query, [shortCode])
  }

  /** Returns all distinct tag names in use, sorted */
  async getAllTags(): Promise<string[]> {
    const result = await this.pool.query(
      "SELECT DISTINCT tag_name FROM url_tags ORDER BY tag_name"
    )
    return result.rows.map((r: { tag_name: string }) => r.tag_name)
  }

  async addTag(urlId: number, tagName: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO url_tags (url_id, tag_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [urlId, tagName.trim()]
    )
  }

  async removeTag(urlId: number, tagName: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM url_tags WHERE url_id = $1 AND tag_name = $2",
      [urlId, tagName]
    )
    return (result.rowCount ?? 0) > 0
  }

  async getTagsForUrl(urlId: number): Promise<string[]> {
    const result = await this.pool.query(
      "SELECT tag_name FROM url_tags WHERE url_id = $1 ORDER BY tag_name",
      [urlId]
    )
    return result.rows.map((r: { tag_name: string }) => r.tag_name)
  }

  /** Reconciles a URL's tags to exactly match `tags` (adds new, removes missing) */
  private async syncTags(urlId: number, tags: string[]): Promise<void> {
    const current = new Set(await this.getTagsForUrl(urlId))
    const next = new Set(tags.map((t) => t.trim()).filter(Boolean))

    for (const tag of next) {
      if (!current.has(tag)) await this.addTag(urlId, tag)
    }
    for (const tag of current) {
      if (!next.has(tag)) await this.removeTag(urlId, tag)
    }
  }

  private async attachTags(row: Record<string, unknown>): Promise<UrlRecord> {
    const tags = await this.getTagsForUrl(row.id as number)
    return URLRecord.parse({ ...row, tags })
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
}

export const urlService = new UrlService()
