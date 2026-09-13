import {
  getIronSession,
  type IronSession,
  type SessionOptions,
} from "iron-session"
import { cookies } from "next/headers"
import * as client from "openid-client"

function requireEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const apiUrl = requireEnvVar(
  "NEXT_PUBLIC_API_URL",
  process.env.NEXT_PUBLIC_API_URL
)
const appUrl = requireEnvVar(
  "NEXT_PUBLIC_APP_URL",
  process.env.NEXT_PUBLIC_APP_URL
)

export const clientConfig = {
  url: apiUrl,
  audience: apiUrl,
  clientId: requireEnvVar(
    "NEXT_PUBLIC_CLIENT_ID",
    process.env.NEXT_PUBLIC_CLIENT_ID
  ),
  scope: requireEnvVar("NEXT_PUBLIC_SCOPE", process.env.NEXT_PUBLIC_SCOPE),
  redirectUri: `${appUrl}/auth/openiddict`,
  postLogoutRedirectUri: appUrl,
  responseType: "code",
  grantType: "authorization_code",
  postLoginRoute: `${appUrl}/admin`,
  codeChallengeMethod: "S256",
}

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
  return await client.discovery(
    new URL(clientConfig.url),
    clientConfig.clientId
  )
}
