"use client"

import { KeyRound, LogOut } from "lucide-react"
import { useState } from "react"
import { ApiTokensDialog } from "@/components/api-tokens-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Role } from "@/lib/auth"

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  viewer: "Viewer",
}

export function AccountButton({
  user,
  userRole,
}: {
  user: { name: string; email: string }
  userRole: Role
}) {
  const [tokensDialogOpen, setTokensDialogOpen] = useState(false)

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full"
            aria-label="Account"
          >
            <Avatar>
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="text-muted-foreground truncate text-sm">
                {user.email}
              </p>
              <p className="text-muted-foreground text-xs">
                {ROLE_LABELS[userRole]}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setTokensDialogOpen(true)}
          >
            <KeyRound />
            <span>API Tokens</span>
          </Button>
          <a href="/auth/logout" className="mt-2 block">
            <Button variant="outline" className="w-full">
              <LogOut />
              <span>Log out</span>
            </Button>
          </a>
        </PopoverContent>
      </Popover>

      <ApiTokensDialog
        open={tokensDialogOpen}
        onOpenChange={setTokensDialogOpen}
        userRole={userRole}
      />
    </>
  )
}
