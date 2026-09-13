import * as client from "openid-client"
import { clientConfig, getClientConfig, getSession } from "@/lib/auth"

export async function GET() {
  if (!clientConfig) {
    return new Response("Not Found", { status: 404 })
  }

  const session = await getSession()
  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
  const openIdClientConfig = await getClientConfig()
  const parameters: Record<string, string> = {
    redirect_uri: clientConfig.redirectUri,
    scope: clientConfig.scope,
    code_challenge: codeChallenge,
    code_challenge_method: clientConfig.codeChallengeMethod,
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
