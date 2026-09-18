import { Dashboard } from "@/components/dashboard"
import { DomainProvider } from "@/components/domain-provider"
import { LoginPage } from "@/components/login-page"
import { NoAccessPage } from "@/components/no-access-page"
import { env } from "@/env"
import { apiTokenService } from "@/lib/api-tokens"
import { canRead, getSession, isAuthEnabled } from "@/lib/auth"

/**
 * Whether auth is enabled is a runtime setting, so this page must never be
 * prerendered: a build without OIDC configured would otherwise bake an
 * unauthenticated dashboard into the image and serve it to everybody.
 */
export const dynamic = "force-dynamic"

export default async function AdminPage() {
  if (!isAuthEnabled()) {
    return (
      <DomainProvider domain={env.DOMAIN}>
        <Dashboard userRole="admin" />
      </DomainProvider>
    )
  }

  const session = await getSession()

  if (!session.isLoggedIn || !session.userInfo) {
    return <LoginPage />
  }

  const role = session.role ?? null
  if (!canRead(role)) {
    return <NoAccessPage user={session.userInfo} />
  }

  // the dashboard calls the (now bearer-token-authenticated) REST API on the
  // user's behalf, using a token scoped to their own role
  const apiToken = await apiTokenService.mintSessionToken(
    session.userInfo,
    role
  )

  return (
    <DomainProvider domain={env.DOMAIN}>
      <Dashboard user={session.userInfo} userRole={role} apiToken={apiToken} />
    </DomainProvider>
  )
}
