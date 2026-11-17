import { apiTokenService } from "@/lib/api-tokens"
import { defaultSession, getOIDCConfig, getSession } from "@/lib/auth"

export async function GET() {
  const config = getOIDCConfig()
  if (!config) {
    return new Response("Not Found", { status: 404 })
  }

  const session = await getSession()
  if (session.userInfo) {
    await apiTokenService.revokeSessionToken(session.userInfo.sub)
  }
  session.isLoggedIn = defaultSession.isLoggedIn
  session.accessToken = defaultSession.accessToken
  session.userInfo = defaultSession.userInfo
  session.role = defaultSession.role
  session.codeVerifier = defaultSession.codeVerifier
  session.state = defaultSession.state
  await session.save()
  return Response.redirect(`${config.postLogoutRedirectUri}/admin`)
}
