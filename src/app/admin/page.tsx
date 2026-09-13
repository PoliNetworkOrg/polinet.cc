import { Dashboard } from "@/components/dashboard"
import { LoginPage } from "@/components/login-page"
import { getSession } from "@/lib/auth"

export default async function AdminPage() {
  const session = await getSession()

  if (!session.isLoggedIn || !session.userInfo) {
    return <LoginPage />
  }

  return <Dashboard user={session.userInfo} />
}
