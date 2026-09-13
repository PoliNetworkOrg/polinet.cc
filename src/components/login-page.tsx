import { LogIn } from "lucide-react"
import Image from "next/image"
import logo from "@/assets/logo.png"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { env } from "@/env"

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image src={logo} alt="PoliNetwork Logo" className="h-16 w-16" />
          <CardTitle className="text-2xl">{env.NEXT_PUBLIC_DOMAIN}</CardTitle>
          <CardDescription>
            Sign in with your PoliNetwork account to manage your short URLs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" aria-label="Sign in">
            <a href="/auth/login" className="block w-full">
              <LogIn />
              <span>Sign in</span>
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
