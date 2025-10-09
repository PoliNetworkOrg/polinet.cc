"use client"

import { useEffect, useState } from "react"
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

interface UrlRecord {
  id: string
  original_url: string
  short_code: string
  created_at: string
  updated_at: string
  click_count: number
}

interface EditUrlDialogProps {
  open: boolean
  url?: UrlRecord
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditUrlDialog({
  open,
  url,
  onOpenChange,
  onSuccess,
}: EditUrlDialogProps) {
  const [originalUrl, setOriginalUrl] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (url) {
      setOriginalUrl(url.original_url)
    } else {
      setOriginalUrl("")
    }
  }, [url])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!originalUrl.trim() || !url) return

    setLoading(true)
    try {
      const response = await fetch(`/api/urls/${url.short_code}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: originalUrl.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("URL updated successfully")
        onSuccess()
      } else {
        toast.error(data.error || "Failed to update URL")
      }
    } catch (error) {
      console.error("Error updating URL:", error)
      toast.error("Failed to update URL")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Short URL</DialogTitle>
          <DialogDescription>
            Update the destination URL for{" "}
            {url ? `pnet.work/${url.short_code}` : "this short URL"}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="short-code" className="text-right">
                Short Code
              </Label>
              <Input
                id="short-code"
                value={url?.short_code || ""}
                className="col-span-3"
                disabled
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="original-url" className="text-right">
                URL
              </Label>
              <Input
                id="original-url"
                type="url"
                placeholder="https://example.polinetwork.org/path"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !originalUrl.trim()}>
              {loading ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
