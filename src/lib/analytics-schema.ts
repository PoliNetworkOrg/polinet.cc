/**
 * DDL for the privacy-preserving analytics tables. Kept in one place so the
 * startup migration (src/lib/db.ts) and the test harness create identical
 * schemas.
 *
 * All tables are AGGREGATE-ONLY: they hold no IP addresses, no User-Agent
 * strings, no referrers, and no per-user rows beyond a short-lived,
 * daily-rotating dedup hash.
 */
export const ANALYTICS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS click_analytics_buckets (
    id SERIAL PRIMARY KEY,
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    bucket_type VARCHAR(5) NOT NULL,
    bucket_start TIMESTAMP WITH TIME ZONE NOT NULL,
    clicks_count INTEGER NOT NULL DEFAULT 0,
    unique_estimated_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (url_id, bucket_type, bucket_start)
  );
  CREATE INDEX IF NOT EXISTS idx_click_buckets_url ON click_analytics_buckets(url_id);

  CREATE TABLE IF NOT EXISTS click_country_analytics (
    id SERIAL PRIMARY KEY,
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    bucket_date DATE NOT NULL,
    country_code VARCHAR(16) NOT NULL,
    clicks_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (url_id, bucket_date, country_code)
  );
  CREATE INDEX IF NOT EXISTS idx_click_country_url ON click_country_analytics(url_id);

  -- Short-lived dedup table: the ONLY place a (hashed) visitor identifier lives.
  -- daily_visitor_hash = HMAC-SHA256(secret, url_id + UTC-date + IP + UA); it
  -- rotates every day and is purged after ~24-48h. No raw IP/UA is stored.
  CREATE TABLE IF NOT EXISTS daily_unique_click_dedup (
    id SERIAL PRIMARY KEY,
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    bucket_date DATE NOT NULL,
    daily_visitor_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (url_id, bucket_date, daily_visitor_hash)
  );
  CREATE INDEX IF NOT EXISTS idx_dedup_bucket_date ON daily_unique_click_dedup(bucket_date);
`
