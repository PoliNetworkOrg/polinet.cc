import { createHash } from "node:crypto"
import { nanoid } from "nanoid"
import type { Role } from "./auth"
import { getPool } from "./db"

/** Prefix so a leaked personal token is recognizable at a glance. */
const TOKEN_PREFIX = "pn_"
/** Name/prefix shown for the hidden dashboard-only session token. */
const SESSION_TOKEN_NAME = "Dashboard session"

export interface TokenOwner {
  sub: string
  name: string
  email: string
}

export interface ApiTokenAuth {
  tokenId: number
  role: Role
  ownerSub: string
}

export interface ApiTokenRecord {
  id: number
  name: string
  role: Role
  tokenPrefix: string
  createdAt: Date
  lastUsedAt: Date | null
}

function generateRawToken(): string {
  // nanoid for a URL-safe random body; length chosen generously since these
  // are long-lived secrets sent over the wire like any other bearer token.
  return `${TOKEN_PREFIX}${nanoid(40)}`
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

function tokenPrefixOf(rawToken: string): string {
  // enough of the token to help a user recognize it in a list, never enough
  // to reconstruct it
  return rawToken.slice(0, TOKEN_PREFIX.length + 6)
}

function mapRow(row: Record<string, unknown>): ApiTokenRecord {
  return {
    id: row.id as number,
    name: row.name as string,
    role: row.role as Role,
    tokenPrefix: row.token_prefix as string,
    createdAt: row.created_at as Date,
    lastUsedAt: (row.last_used_at as Date | null) ?? null,
  }
}

export class ApiTokenService {
  private pool = getPool()

  /** Creates a personal, user-managed API token. Returned only this once. */
  async create(
    owner: TokenOwner,
    name: string,
    role: Role
  ): Promise<{ token: string; record: ApiTokenRecord }> {
    const token = generateRawToken()
    const result = await this.pool.query(
      `
        INSERT INTO api_tokens
          (name, token_hash, token_prefix, role, owner_sub, owner_name, owner_email, is_session)
        VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
        RETURNING id, name, role, token_prefix, created_at, last_used_at
      `,
      [
        name,
        hashToken(token),
        tokenPrefixOf(token),
        role,
        owner.sub,
        owner.name,
        owner.email,
      ]
    )
    return { token, record: mapRow(result.rows[0]) }
  }

  /** Lists a user's own personal tokens (never the hidden session token). */
  async list(ownerSub: string): Promise<ApiTokenRecord[]> {
    const result = await this.pool.query(
      `
        SELECT id, name, role, token_prefix, created_at, last_used_at
        FROM api_tokens
        WHERE owner_sub = $1 AND is_session = FALSE
        ORDER BY created_at DESC, id DESC
      `,
      [ownerSub]
    )
    return result.rows.map(mapRow)
  }

  /** Revokes one of a user's own personal tokens. */
  async revoke(id: number, ownerSub: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM api_tokens WHERE id = $1 AND owner_sub = $2 AND is_session = FALSE",
      [id, ownerSub]
    )
    return (result.rowCount ?? 0) > 0
  }

  /**
   * (Re)issues the hidden token the `/admin` dashboard uses to call the REST
   * API as the logged-in user. Replaces any previous one for that user so
   * they don't pile up across visits.
   */
  async mintSessionToken(owner: TokenOwner, role: Role): Promise<string> {
    const token = generateRawToken()
    await this.pool.query(
      "DELETE FROM api_tokens WHERE owner_sub = $1 AND is_session = TRUE",
      [owner.sub]
    )
    await this.pool.query(
      `
        INSERT INTO api_tokens
          (name, token_hash, token_prefix, role, owner_sub, owner_name, owner_email, is_session)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      `,
      [
        SESSION_TOKEN_NAME,
        hashToken(token),
        tokenPrefixOf(token),
        role,
        owner.sub,
        owner.name,
        owner.email,
      ]
    )
    return token
  }

  /** Called on logout so a stale session token can't outlive the session. */
  async revokeSessionToken(ownerSub: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM api_tokens WHERE owner_sub = $1 AND is_session = TRUE",
      [ownerSub]
    )
  }

  /** Resolves a raw bearer token to its role and owner, or `null`. */
  async verify(rawToken: string): Promise<ApiTokenAuth | null> {
    const result = await this.pool.query(
      "SELECT id, role, owner_sub FROM api_tokens WHERE token_hash = $1",
      [hashToken(rawToken)]
    )
    const row = result.rows[0]
    if (!row) return null

    // best-effort bookkeeping, must never block or fail the request
    this.pool
      .query(
        "UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1",
        [row.id]
      )
      .catch((error) => {
        console.error("Failed to update api_tokens.last_used_at:", error)
      })

    return { tokenId: row.id, role: row.role, ownerSub: row.owner_sub }
  }

  /** Downgrades all API tokens for a user to the 'viewer' role, in case the user's role was downgraded. */
  async downgradeTokensForViewer(ownerSub: string): Promise<void> {
    await this.pool
      .query(
        "UPDATE api_tokens SET role = 'viewer' WHERE owner_sub = $1 AND role != 'viewer'",
        [ownerSub]
      )
      .catch((error) => {
        console.error("Failed to downgrade api_tokens for viewer:", error)
      })
  }

  /** Revokes all API tokens for a user, in case the user is no longer authorized. */
  async revokeTokensForUser(ownerSub: string): Promise<void> {
    await this.pool
      .query("DELETE FROM api_tokens WHERE owner_sub = $1", [ownerSub])
      .catch((error) => {
        console.error("Failed to revoke api_tokens for user:", error)
      })
  }
}

export const apiTokenService = new ApiTokenService()

/**
 * Extracts the bearer token from a raw `Authorization` header value, e.g.
 * `Bearer pn_abc123` -> `pn_abc123`.
 */
export function parseBearerToken(
  authorizationHeader: string | undefined | null
): string | null {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}
