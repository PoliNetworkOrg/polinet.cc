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
    }

    const query = `
      INSERT INTO urls (original_url, short_code)
      VALUES ($1, $2)
      RETURNING *
    `

    const result = await this.pool.query(query, [originalUrl, shortCode])
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
      sortOrder = "desc",
    } = options

    const offset = (page - 1) * limit
    const params: (string | number)[] = []
    let paramIndex = 1

    // Build WHERE clause for search
    let whereClause = ""
    if (search) {
      whereClause = `WHERE (original_url ILIKE $${paramIndex} OR short_code ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Build ORDER BY clause
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM urls ${whereClause}`
    const countResult = await this.pool.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count, 10)

    // Get paginated results
    const dataQuery = `
      SELECT * FROM urls 
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const dataResult = await this.pool.query(dataQuery, params)

    return {
      urls: URLRecords.parse(dataResult.rows),
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
