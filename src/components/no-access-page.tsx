import { LogOut, ShieldAlert } from "lucide-react"
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

export function NoAccessPage({
  user,
}: {
  user: { name: string; email: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image src={logo} alt="PoliNetwork Logo" className="h-16 w-16" />
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            {env.NEXT_PUBLIC_DOMAIN}
          </CardTitle>
          <CardDescription>
            {user.email} has no role on this dashboard. Ask an administrator to
            grant you access, then sign in again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/auth/logout" className="block">
            <Button variant="outline" size="lg" className="w-full">
              <LogOut />
              <span>Log out</span>
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
