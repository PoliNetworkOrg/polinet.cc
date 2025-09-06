import { nanoid } from "nanoid"
import { getPool, type UrlRecord } from "./db"

export class UrlService {
  private pool = getPool()

  async createShortUrl(originalUrl: string): Promise<UrlRecord> {
    const shortCode = nanoid(8)

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
    return result.rows[0] || null
  }

  async getAllUrls(): Promise<UrlRecord[]> {
    const query = "SELECT * FROM urls ORDER BY created_at DESC"
    const result = await this.pool.query(query)
    return result.rows
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
