import { apiTokenService } from "@/lib/api-tokens"
import { clientConfig, defaultSession, getSession } from "@/lib/auth"

export async function GET() {
  if (!clientConfig) {
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
  return Response.redirect(`${clientConfig.postLogoutRedirectUri}/admin`)
}
