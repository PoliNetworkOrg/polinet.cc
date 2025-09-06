import { Pool } from "pg"

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  }
  return pool
}

export interface UrlRecord {
  id: string
  original_url: string
  short_code: string
  created_at: Date
  updated_at: Date
  click_count: number
}

export async function initDatabase() {
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
    console.log("Database tables initialized successfully")
  } catch (error) {
    console.error("Error initializing database:", error)
    throw error
  }
}
