"use client"

import { ArrowUpToLine, GitBranch, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  addAliasAction,
  getAliasStats,
  promoteAliasAction,
  removeAliasAction,
} from "@/lib/actions"
import type { AliasStatsResult, UrlRecord } from "@/lib/schemas"
import { relativeTime } from "@/lib/utils"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Input } from "./ui/input"

interface AliasStatsDialogProps {
  open: boolean
  url?: UrlRecord
  onClose: () => void
  onChanged: () => void
}

export function AliasStatsDialog({
  open,
  url,
  onClose,
  onChanged,
}: AliasStatsDialogProps) {
  const [stats, setStats] = useState<AliasStatsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [aliasInput, setAliasInput] = useState("")
  const [pending, setPending] = useState<string | null>(null)

  const refresh = async (shortCode: string) => {
    setLoading(true)
    try {
      setStats(await getAliasStats(shortCode))
    } catch {
      toast.error("Failed to load alias stats")
    } finally {
      setLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens for a URL, not on every stats refresh
  useEffect(() => {
    if (open && url) {
      setAliasInput("")
      refresh(url.short_code)
    }
  }, [open, url?.id])

  if (!url) return null

  const handleAdd = async () => {
    const trimmed = aliasInput.trim()
    if (!trimmed) return
    setPending("add")
    try {
      await addAliasAction(url.id, trimmed)
      setAliasInput("")
      await refresh(url.short_code)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add alias")
    } finally {
      setPending(null)
    }
  }

  const handleRemove = async (aliasCode: string) => {
    setPending(aliasCode)
    try {
      await removeAliasAction(url.id, aliasCode)
      await refresh(url.short_code)
      onChanged()
    } catch {
      toast.error("Failed to remove alias")
    } finally {
      setPending(null)
    }
  }

  const handlePromote = async (aliasCode: string) => {
    setPending(aliasCode)
    try {
      const promoted = await promoteAliasAction(url.id, aliasCode)
      if (!promoted) {
        toast.error("Alias not found")
      } else {
        toast.success(`/${aliasCode} is now the primary code`)
        onChanged()
        onClose()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to promote alias")
    } finally {
      setPending(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />/
            {url.short_code}
          </DialogTitle>
          <DialogDescription>
            Manage aliases and see per-route click stats.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAdd()
              }
            }}
            placeholder="Add alias short code…"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAdd}
            disabled={pending === "add"}
          >
            Add
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Loading…
          </p>
        ) : !stats ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No stats available.
          </p>
        ) : (
          <div className="flex flex-col divide-y rounded-md border overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2 text-sm bg-muted/40">
              <span className="flex-1 font-mono">/{url.short_code}</span>
              <span className="text-xs text-muted-foreground">primary</span>
              <span className="w-20 text-right tabular-nums">
                {stats.urlClickCount} clicks
              </span>
              <span className="w-24 text-right text-xs text-muted-foreground">
                {relativeTime(stats.urlLastClickedAt)}
              </span>
            </div>
            {stats.aliases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No aliases yet.
              </p>
            ) : (
              stats.aliases.map((a) => (
                <div
                  key={a.alias_code}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="flex-1 font-mono truncate">
                    /{a.alias_code}
                  </span>
                  <span className="w-20 text-right tabular-nums">
                    {a.click_count} clicks
                  </span>
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    {relativeTime(a.last_clicked_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePromote(a.alias_code)}
                    disabled={pending !== null}
                    title={`Set /${a.alias_code} as the primary code`}
                    aria-label={`Set /${a.alias_code} as the primary code`}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowUpToLine className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(a.alias_code)}
                    disabled={pending !== null}
                    title={`Remove /${a.alias_code}`}
                    aria-label={`Remove /${a.alias_code}`}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    {pending === a.alias_code ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
