import { Pool, type PoolConfig } from "pg"
import { env } from "@/env"

let pool: Pool | null = null

const DB_CONNECTION: PoolConfig = env.DB_URL
  ? {
      connectionString: env.DB_URL,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASS,
      database: env.DB_NAME,
    }

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ ...DB_CONNECTION })
  }
  return pool
}

async function initDatabase() {
  const pool = getPool()

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS urls (
      id SERIAL PRIMARY KEY,
      original_url TEXT NOT NULL,
      short_code VARCHAR(25) UNIQUE NOT NULL,
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
