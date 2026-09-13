import { Dashboard } from "@/components/dashboard"
import { LoginPage } from "@/components/login-page"
import { NoAccessPage } from "@/components/no-access-page"
import { canRead, getSession, isAuthEnabled } from "@/lib/auth"

export default async function AdminPage() {
  if (!isAuthEnabled) {
    return <Dashboard userRole="admin" />
  }

  const session = await getSession()

  if (!session.isLoggedIn || !session.userInfo) {
    return <LoginPage />
  }

  const role = session.role ?? null
  if (!canRead(role)) {
    return <NoAccessPage user={session.userInfo} />
  }

  return <Dashboard user={session.userInfo} userRole={role} />
}
