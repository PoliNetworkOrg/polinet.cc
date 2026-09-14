import { randomBytes } from "node:crypto"
import {
  getIronSession,
  type IronSession,
  type SessionOptions,
} from "iron-session"
import { cookies } from "next/headers"
import * as client from "openid-client"
import { env } from "@/env"

const domain = env.NEXT_PUBLIC_DOMAIN
const appUrl = domain?.startsWith("localhost")
  ? `http://${domain}`
  : `https://${domain}`

// OIDC login is entirely optional: when any of these are left unset, auth is
// disabled and `/admin` is served without a login gate.
export const getOIDCConfig = () =>
  env.NEXT_PUBLIC_OIDC_URL &&
  env.NEXT_PUBLIC_OIDC_CLIENT_ID &&
  env.NEXT_PUBLIC_OIDC_SCOPE
    ? {
        url: env.NEXT_PUBLIC_OIDC_URL,
        audience: env.NEXT_PUBLIC_OIDC_URL,
        clientId: env.NEXT_PUBLIC_OIDC_CLIENT_ID,
        scope: env.NEXT_PUBLIC_OIDC_SCOPE,
        redirectUri: `${appUrl}/auth/openiddict`,
        postLogoutRedirectUri: appUrl,
        responseType: "code",
        grantType: "authorization_code",
        postLoginRoute: `${appUrl}/admin`,
        codeChallengeMethod: "S256",
      }
    : undefined

export const isAuthEnabled = () => Boolean(getOIDCConfig)

/**
 * Internal roles: `admin` can read and modify, `viewer` can only read.
 */
export type Role = "admin" | "viewer"

// Role mapping is entirely optional too: when any of these is left unset every
// logged in user is treated as an admin.
export const rolesConfig =
  env.ROLES_CLAIM && env.ROLE_ADMIN && env.ROLE_VIEWER
    ? {
        claim: env.ROLES_CLAIM,
        admin: env.ROLE_ADMIN,
        viewer: env.ROLE_VIEWER,
      }
    : undefined

export const isRoleMappingEnabled = Boolean(rolesConfig)

export interface SessionData {
  isLoggedIn: boolean
  accessToken?: string
  codeVerifier?: string
  state?: string
  role?: Role
  userInfo?: {
    sub: string
    name: string
    email: string
  }
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
  accessToken: undefined,
  codeVerifier: undefined,
  state: undefined,
  role: undefined,
  userInfo: undefined,
}

export const sessionOptions: SessionOptions = {
  password: randomBytes(32).toString("hex"), // session encryption key is generated at startup, restarting the server invalidates all sessions
  cookieName: "polinet_cc_session",
  cookieOptions: {
    // secure only works in `https` environments
    // if your localhost is not on `https`, then use: `secure: process.env.NODE_ENV === "production"`
    secure: process.env.NODE_ENV === "production",
  },
  ttl: 60 * 60 * 24 * 7, // 1 week
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookiesList = await cookies()
  const session = await getIronSession<SessionData>(cookiesList, sessionOptions)
  if (!session.isLoggedIn) {
    session.accessToken = defaultSession.accessToken
    session.userInfo = defaultSession.userInfo
    session.role = defaultSession.role
  }
  return session
}

export async function getClientConfig() {
  const config = getOIDCConfig()
  if (!config) {
    throw new Error("OIDC is not configured")
  }
  return await client.discovery(new URL(config.url), config.clientId)
}

/**
 * Normalizes a claim value into the list of role names it carries. Providers
 * hand roles over either as an array or as a single separated string.
 */
function claimToRoleNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string")
  }
  if (typeof value === "string") {
    return value.split(/[\s,]+/).filter(Boolean)
  }
  return []
}

/**
 * Maps the claims of a logged in user onto an internal role. Returns `null`
 * when role mapping is enabled and the user carries neither configured role,
 * meaning they have no access at all.
 */
export function resolveRole(claims: Record<string, unknown>): Role | null {
  if (!rolesConfig) {
    // no (or incomplete) mapping configured: everybody is an admin
    return "admin"
  }
  const roleNames = claimToRoleNames(claims[rolesConfig.claim])
  if (roleNames.includes(rolesConfig.admin)) return "admin"
  if (roleNames.includes(rolesConfig.viewer)) return "viewer"
  return null
}

/**
 * The role of the current user, or `null` when they have no access. With auth
 * disabled there is no user to speak of and everybody is an admin.
 */
export async function getRole(): Promise<Role | null> {
  if (!isAuthEnabled()) return "admin"
  const session = await getSession()
  if (!session.isLoggedIn || !session.userInfo) return null
  return session.role ?? null
}

/** Reading features are open to both roles. */
export function canRead(role: Role | null): role is Role {
  return role === "admin" || role === "viewer"
}

/** Modifying features are reserved to admins. */
export function canWrite(role: Role | null): role is "admin" {
  return role === "admin"
}
