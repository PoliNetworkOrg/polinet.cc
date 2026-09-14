import * as client from "openid-client"
import { getClientConfig, getOIDCConfig, getSession } from "@/lib/auth"

export async function GET() {
  const config = getOIDCConfig()
  if (!config) {
    return new Response("Not Found", { status: 404 })
  }

  const session = await getSession()
  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
  const openIdClientConfig = await getClientConfig()
  const parameters: Record<string, string> = {
    redirect_uri: config.redirectUri,
    scope: config.scope,
    code_challenge: codeChallenge,
    code_challenge_method: config.codeChallengeMethod,
  }
  const state = client.randomState()
  parameters.state = state
  const redirectTo = client.buildAuthorizationUrl(
    openIdClientConfig,
    parameters
  )
  session.codeVerifier = codeVerifier
  session.state = state
  await session.save()
  return Response.redirect(redirectTo.href)
}
