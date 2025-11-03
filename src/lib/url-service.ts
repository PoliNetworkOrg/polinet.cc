import { nanoid } from "nanoid"
import { getPool } from "./db"
import {
  type GetUrlsQueryParams,
  type PaginatedUrlsResponse,
  URLRecords,
  type UrlRecord,
} from "./schemas"

export class UrlService {
  private pool = getPool()

  async createShortUrl(
    originalUrl: string,
    customShortCode?: string
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
    return result.rows[0]
  }

  async getUrlByShortCode(shortCode: string): Promise<UrlRecord | null> {
    const query = "SELECT * FROM urls WHERE short_code = $1"
    const result = await this.pool.query(query, [shortCode])
    console.log("Query result:", result.rows)
    return result.rows[0] || null
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
    const urls = URLRecords.parse(dataResult.rows)

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
    originalUrl: string
  ): Promise<UrlRecord | null> {
    const query = `
      UPDATE urls 
      SET original_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE short_code = $2
      RETURNING *
    `

    const result = await this.pool.query(query, [originalUrl, shortCode])
    return result.rows[0] || null
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
}

export const urlService = new UrlService()
