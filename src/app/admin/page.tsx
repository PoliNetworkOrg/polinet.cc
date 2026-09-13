import { Dashboard } from "@/components/dashboard"
import { LoginPage } from "@/components/login-page"
import { getSession, isAuthEnabled } from "@/lib/auth"

export default async function AdminPage() {
  if (!isAuthEnabled) {
    return <Dashboard />
  }

  const session = await getSession()

  if (!session.isLoggedIn || !session.userInfo) {
    return <LoginPage />
  }

  return <Dashboard user={session.userInfo} />
}
