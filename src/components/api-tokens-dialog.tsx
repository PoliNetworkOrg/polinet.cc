"use client"

import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, KeyRound, Trash2 } from "lucide-react"
import { useActionState, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Role } from "@/lib/auth"
import type { ApiTokenSummary } from "@/lib/schemas"
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from "@/lib/token-actions"
import { copyToClipboard } from "@/lib/utils"
import { createApiTokenSchema } from "@/lib/validations"

interface ApiTokensDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** the current user's own role, which caps what a token can be minted as */
  userRole: Role
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin (read & modify)",
  viewer: "Viewer (read only)",
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleString() : "Never"
}

export function ApiTokensDialog({
  open,
  onOpenChange,
  userRole,
}: ApiTokensDialogProps) {
  const queryClient = useQueryClient()
  const { data: tokens, isLoading } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () => listApiTokens(),
    enabled: open,
  })

  const [{ error, lastResult, createdToken }, action, pending] = useActionState(
    createApiToken,
    {
      error: null,
      lastResult: null,
      createdToken: null,
    }
  )
  const [role, setRole] = useState<Role>(
    userRole === "admin" ? "admin" : "viewer"
  )
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(createApiTokenSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: createApiTokenSchema }),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  })
  const formRef = useRef<HTMLFormElement>(null)
  // the reveal panel stays up until the user acknowledges it, even though
  // `createdToken` itself doesn't clear between renders
  const [dismissedTokenId, setDismissedTokenId] = useState<number | null>(null)
  const revealedToken =
    createdToken && createdToken.id !== dismissedTokenId ? createdToken : null

  useEffect(() => {
    if (lastResult && createdToken) {
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] })
    } else if (lastResult && error) {
      toast.error(`Error creating API token: ${error}`)
    }
  }, [lastResult, createdToken, error, queryClient])

  const [revokingId, setRevokingId] = useState<number | null>(null)
  const handleRevoke = async (token: ApiTokenSummary) => {
    if (
      !confirm(`Revoke the API token "${token.name}"? This cannot be undone.`)
    )
      return
    setRevokingId(token.id)
    try {
      const { error } = await revokeApiToken(token.id)
      if (error) {
        toast.error(error)
      } else {
        toast.success("API token revoked")
        queryClient.invalidateQueries({ queryKey: ["api-tokens"] })
      }
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] flex flex-col">
        <DialogHeader>
          <DialogTitle>API Tokens</DialogTitle>
          <DialogDescription>
            Personal tokens for calling the REST API. Anyone with a token can
            act as you, up to its role — keep them secret.
          </DialogDescription>
        </DialogHeader>

        {revealedToken ? (
          <div className="space-y-3 rounded-md border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium">
              Copy your new token now — you won't be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">
                {revealedToken.token}
              </code>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(revealedToken.token)}
              >
                <Copy />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                formRef.current?.reset()
                setDismissedTokenId(revealedToken.id)
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <form
            {...getFormProps(form, {})}
            ref={formRef}
            action={action}
            className="space-y-3"
          >
            <div className="flex flex-col gap-2 items-stretch">
              <div className="flex-1 space-y-1">
                <Label htmlFor={fields.name.id}>Name</Label>
                <Input
                  {...getInputProps(fields.name, { type: "text" })}
                  placeholder="e.g. deploy script"
                />
              </div>
              <div className="flex flex-1 gap-2 items-end justify-between">
                <div className="flex flex-col flex-1 gap-1">
                  <Label>Role</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as Role)}
                    disabled={userRole !== "admin"}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        {ROLE_LABELS.viewer}
                      </SelectItem>
                      {userRole === "admin" && (
                        <SelectItem value="admin">
                          {ROLE_LABELS.admin}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name={fields.role.name} value={role} />
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
            {fields.name.errors && (
              <p className="text-xs text-red-600">{fields.name.errors}</p>
            )}
          </form>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Your tokens</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !tokens || tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no personal API tokens yet.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex items-center gap-3 p-3 text-sm"
                >
                  <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{token.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {token.tokenPrefix}… · {ROLE_LABELS[token.role]}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Created {formatDate(token.createdAt)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Last used {formatDate(token.lastUsedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={revokingId === token.id}
                    onClick={() => handleRevoke(token)}
                  >
                    <Trash2 className="stroke-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
