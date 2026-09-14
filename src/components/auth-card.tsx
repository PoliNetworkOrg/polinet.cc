import Image from "next/image"
import type { ReactNode } from "react"

import logo from "@/assets/logo.png"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { env } from "@/env"

export function AuthCard({
  children,
  description,
  titleIcon,
}: {
  children: ReactNode
  description: ReactNode
  titleIcon?: ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <Card className="min-w-0 w-full max-w-sm">
        <CardHeader className="min-w-0 justify-items-center text-center">
          <Image
            src={logo}
            alt="PoliNetwork Logo"
            className="size-16 justify-self-center"
            priority
          />
          <CardTitle className="flex min-w-0 max-w-full items-center justify-center gap-2 text-2xl">
            {titleIcon}
            <span className="min-w-0 break-words">
              {env.NEXT_PUBLIC_DOMAIN}
            </span>
          </CardTitle>
          <CardDescription className="w-full min-w-0 break-words">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  )
}
