import {
  getIronSession,
  type IronSession,
  type SessionOptions,
} from "iron-session"
import { cookies } from "next/headers"
import * as client from "openid-client"
import { env } from "@/env"

const domain = env.NEXT_PUBLIC_DOMAIN
const appUrl = domain.startsWith("localhost")
  ? `http://${env.NEXT_PUBLIC_DOMAIN}`
  : `https://${env.NEXT_PUBLIC_DOMAIN}`

// OIDC login is entirely optional: when any of these are left unset, auth is
// disabled and `/admin` is served without a login gate.
export const clientConfig =
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

export const isAuthEnabled = Boolean(clientConfig)

export interface SessionData {
  isLoggedIn: boolean
  accessToken?: string
  codeVerifier?: string
  state?: string
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
  userInfo: undefined,
}

export const sessionOptions: SessionOptions = {
  password: "complex_password_at_least_32_characters_long",
  cookieName: "next_js_session",
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
  }
  return session
}

export async function getClientConfig() {
  if (!clientConfig) {
    throw new Error("OIDC is not configured")
  }
  return await client.discovery(
    new URL(clientConfig.url),
    clientConfig.clientId
  )
}
