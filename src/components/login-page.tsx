import { LogIn } from "lucide-react"
import { AuthCard } from "@/components/auth-card"
import { Button } from "@/components/ui/button"

export function LoginPage() {
  return (
    <AuthCard description="Sign in with your PoliNetwork account to manage your short URLs">
      <Button asChild size="lg" aria-label="Sign in">
        <a href="/auth/login" className="block w-full">
          <LogIn />
          <span>Sign in</span>
        </a>
      </Button>
    </AuthCard>
  )
}
