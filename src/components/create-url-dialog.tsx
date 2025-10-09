"use client"

import { useState } from "react"
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

interface CreateUrlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateUrlDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateUrlDialogProps) {
  const [url, setUrl] = useState("")
  const [shortCode, setShortCode] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    try {
      const requestBody: { url: string; shortCode?: string } = {
        url: url.trim(),
      }

      if (shortCode.trim()) {
        requestBody.shortCode = shortCode.trim()
      }

      const response = await fetch("/api/urls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Short URL created: ${data.short_code}`)
        setUrl("")
        setShortCode("")
        onSuccess()
      } else {
        toast.error(data.error || "Failed to create short URL")
      }
    } catch (error) {
      console.error("Error creating URL:", error)
      toast.error("Failed to create short URL")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Short URL</DialogTitle>
          <DialogDescription>
            Enter a URL from tommasomorganti.com domain to create a short URL.
            Optionally specify a custom short code.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid col-span-4 grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right">
                URL
              </Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.tommasomorganti.com/path"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid col-span-4 grid-cols-4 items-center gap-4">
              <Label htmlFor="shortCode" className="text-right">
                Short Code
              </Label>
              <Input
                id="shortCode"
                type="text"
                placeholder="custom-code (optional)"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                className="col-span-3"
                pattern="[a-zA-Z0-9_\-]{3,20}"
                minLength={3}
                maxLength={20}
                title="Short code can only contain letters, numbers, hyphens and underscores (3-20 characters)"
              />
            </div>
            <div className="col-span-4 text-sm text-muted-foreground">
              Leave short code empty to auto-generate a random one.
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
            <Button type="submit" disabled={loading || !url.trim()}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
