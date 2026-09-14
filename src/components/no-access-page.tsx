import { LogOut, ShieldAlert } from "lucide-react"
import { AuthCard } from "@/components/auth-card"
import { Button } from "@/components/ui/button"

export function NoAccessPage({
  user,
}: {
  user: { name: string; email: string }
}) {
  return (
    <AuthCard
      titleIcon={<ShieldAlert className="size-5 shrink-0 text-destructive" />}
      description={
        <>
          {user.email} has no role on this dashboard. Ask an administrator to
          grant you access, then sign in again.
        </>
      }
    >
      <Button asChild variant="outline" size="lg">
        <a href="/auth/logout" className="block w-full">
          <LogOut />
          <span>Log out</span>
        </a>
      </Button>
    </AuthCard>
  )
}
