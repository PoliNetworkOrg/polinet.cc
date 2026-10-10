import type { NextRequest } from "next/server"
import * as client from "openid-client"
import { apiTokenService } from "@/lib/api-tokens"
import {
  getClientConfig,
  getOIDCConfig,
  getSession,
  resolveRole,
} from "@/lib/auth"

export async function GET(request: NextRequest) {
  const config = getOIDCConfig()
  if (!config) {
    return new Response("Not Found", { status: 404 })
  }

  const session = await getSession()
  const openIdClientConfig = await getClientConfig()
  // openid-client sends this URL, minus the query, as the token request's
  // redirect_uri, which must match the one used at login exactly. Building it
  // from the configured redirect URI keeps it independent of proxy headers:
  // behind Cloudflare Tunnel and Traefik, X-Forwarded-Proto arrives as `http`.
  const currentUrl = new URL(config.redirectUri)
  currentUrl.search = request.nextUrl.search

  const tokenSet = await client.authorizationCodeGrant(
    openIdClientConfig,
    currentUrl,
    { pkceCodeVerifier: session.codeVerifier, expectedState: session.state }
  )

  const { access_token: accessToken } = tokenSet
  session.isLoggedIn = true
  session.accessToken = accessToken

  const claims = tokenSet.claims()
  if (!claims) {
    throw new Error("Token response is missing ID token claims")
  }
  const { sub } = claims
  // call userinfo endpoint to get user info
  const userinfo = await client.fetchUserInfo(
    openIdClientConfig,
    accessToken,
    sub
  )
  // store userinfo in session
  session.userInfo = {
    sub: userinfo.sub,
    name: userinfo.given_name ?? userinfo.name ?? "",
    email: userinfo.email ?? "",
  }

  // the roles claim can be carried by either the ID token or the userinfo
  // response, so both are looked at (userinfo wins)
  session.role = resolveRole({ ...claims, ...userinfo }) ?? undefined

  if (session.role === "viewer") {
    // downgrade all API tokens to viewer role if the user is a viewer, to prevent privilege escalation
    await apiTokenService.downgradeTokensForViewer(session.userInfo.sub)
  } else if (!session.role) {
    // revoke all API tokens if the user has no role, to prevent privilege escalation
    await apiTokenService.revokeTokensForUser(session.userInfo.sub)
  }

  await session.save()
  return Response.redirect(config.postLoginRoute)
}
