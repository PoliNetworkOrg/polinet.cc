"use client"

import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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

export function AccountButton({
  user,
}: {
  user: { name: string; email: string }
}) {
  return (
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
          </div>
        </div>
        <a href="/auth/logout" className="mt-4 block">
          <Button variant="outline" className="w-full">
            <LogOut />
            <span>Log out</span>
          </Button>
        </a>
      </PopoverContent>
    </Popover>
  )
}
