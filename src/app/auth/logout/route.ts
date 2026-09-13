import * as client from "openid-client"
import {
  clientConfig,
  defaultSession,
  getClientConfig,
  getSession,
} from "@/lib/auth"

export async function GET() {
  if (!clientConfig) {
    return new Response("Not Found", { status: 404 })
  }

  const session = await getSession()
  const openIdClientConfig = await getClientConfig()
  const endSessionUrl = client.buildEndSessionUrl(openIdClientConfig, {
    post_logout_redirect_uri: clientConfig.postLogoutRedirectUri,
    id_token_hint: session.accessToken ?? "",
  })
  session.isLoggedIn = defaultSession.isLoggedIn
  session.accessToken = defaultSession.accessToken
  session.userInfo = defaultSession.userInfo
  session.role = defaultSession.role
  session.codeVerifier = defaultSession.codeVerifier
  session.state = defaultSession.state
  await session.save()
  return Response.redirect(endSessionUrl.href)
}
