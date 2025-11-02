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
    CREATE INDEX IF NOT EXISTS idx_updated_at ON urls(updated_at);
    CREATE INDEX IF NOT EXISTS idx_click_count ON urls(click_count);
  `

  try {
    await pool.query(createTableQuery)
  } catch (error) {
    console.error("Error initializing database:", error)
  }
}

let init = false
// Skip initialization if env where not validated
// this doesn't prevent DB calls to be made, but if the env is not validated
// it probably means that DB calls will not be made anyway (e.g. during builds)
// and if they are made, they'll probably fail, as will this initialization
if (!init && !process.env.SKIP_ENV_VALIDATION) {
  init = true
  initDatabase()
    .then(() => {
      console.log("Database initialized successfully")
    })
    .catch((error) => {
      console.error("Error during database initialization:", error)
    })
}
