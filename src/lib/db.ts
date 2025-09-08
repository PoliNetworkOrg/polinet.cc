import { Pool } from "pg"
import z from "zod"

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  }
  return pool
}

export const URLRecord = z.object({
  id: z.string(),
  original_url: z.string().url(),
  short_code: z.string().length(8),
  created_at: z.date(),
  updated_at: z.date(),
  click_count: z.number().int().nonnegative(),
})

export type UrlRecord = z.infer<typeof URLRecord>

async function initDatabase() {
  const pool = getPool()

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS urls (
      id SERIAL PRIMARY KEY,
      original_url TEXT NOT NULL,
      short_code VARCHAR(10) UNIQUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      click_count INTEGER DEFAULT 0
    );
    
    CREATE INDEX IF NOT EXISTS idx_short_code ON urls(short_code);
    CREATE INDEX IF NOT EXISTS idx_created_at ON urls(created_at);
  `

  try {
    await pool.query(createTableQuery)
  } catch (error) {
    console.error("Error initializing database:", error)
  }
}

let init = false
if (!init) {
  initDatabase()
  init = true
}
