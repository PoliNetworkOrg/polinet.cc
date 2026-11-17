import { DataType, newDb } from "pg-mem"

/**
 * An in-memory database with the Postgres functions the services call that
 * pg-mem lacks. pg-mem runs one query at a time, so locks are no-ops.
 */
export function newTestDb(...args: Parameters<typeof newDb>) {
  const db = newDb(...args)
  db.public.registerFunction({
    name: "pg_advisory_xact_lock",
    args: [DataType.integer, DataType.integer],
    returns: DataType.text,
    implementation: () => null,
    impure: true,
  })
  return db
}
