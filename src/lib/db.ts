import fs from "node:fs/promises"
import path from "node:path"
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
  const initSqlPath = path.join(process.cwd(), "src/sql/init.sql")

  try {
    const initQuery = await fs.readFile(initSqlPath, "utf-8")
    await pool.query(initQuery)
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
