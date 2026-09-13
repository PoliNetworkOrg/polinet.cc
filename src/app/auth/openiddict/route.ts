import { headers } from "next/headers"
import type { NextRequest } from "next/server"
import * as client from "openid-client"
import { clientConfig, getClientConfig, getSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await getSession()
  const openIdClientConfig = await getClientConfig()
  const headerList = await headers()
  const host =
    headerList.get("x-forwarded-host") || headerList.get("host") || "localhost"

  const protocol = headerList.get("x-forwarded-proto") || "https"
  const currentUrl = new URL(
    `${protocol}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`
  )

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

  await session.save()
  return Response.redirect(clientConfig.postLoginRoute)
}
