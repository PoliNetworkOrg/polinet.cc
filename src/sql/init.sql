CREATE TABLE IF NOT EXISTS urls (
  id SERIAL PRIMARY KEY,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE TABLE IF NOT EXISTS url_tags (
  url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  tag_name VARCHAR(50) NOT NULL,
  PRIMARY KEY (url_id, tag_name)
);

CREATE INDEX IF NOT EXISTS idx_url_tags_tag_name ON url_tags(tag_name);

-- Personal API tokens used to authenticate REST API requests, plus one
-- special "session" token per user that lets the /admin dashboard itself
-- call the REST API on the logged-in user's behalf (is_session = TRUE,
-- hidden from the user's own token management UI, reissued on every visit).
CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  token_hash CHAR(64) UNIQUE NOT NULL,
  token_prefix VARCHAR(16) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'viewer')),
  is_session BOOLEAN NOT NULL DEFAULT FALSE,
  owner_sub VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  owner_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_owner_sub ON api_tokens(owner_sub);