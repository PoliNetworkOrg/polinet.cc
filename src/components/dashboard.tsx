"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useUrls } from "@/hooks/urls"
import type { UrlRecord } from "@/lib/schemas"
import { CreateUrlDialog } from "./create-url-dialog"
import { EditUrlDialog } from "./edit-url-dialog"
import { UrlEntry } from "./url-entry"

export function Dashboard() {
  const { urls, loading, fetchUrls } = useUrls()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    url?: UrlRecord
  }>({ open: false })

  const handleDelete = async (shortCode: string) => {
    if (!confirm("Are you sure you want to delete this URL?")) return

    try {
      const response = await fetch(`/api/urls/${shortCode}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("URL deleted successfully")
        fetchUrls()
      } else {
        toast.error("Failed to delete URL")
      }
    } catch (error) {
      console.error("Error deleting URL:", error)
      toast.error("Failed to delete URL")
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch (error) {
      console.error("Error copying to clipboard:", error)
      toast.error("Failed to copy to clipboard")
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">URL Shortener Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your shortened URLs for PoliNetwork domains
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          Create Short URL
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your URLs</CardTitle>
          <CardDescription>
            All your shortened URLs and their statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-6">Loading...</div>
          ) : urls.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No URLs found. Create your first short URL to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Short URL</TableHead>
                  <TableHead>Original URL</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {urls.map((url) => (
                  <UrlEntry
                    key={url.id}
                    url={url}
                    onCopy={(url) =>
                      copyToClipboard(`https://polinet.cc/${url.short_code}`)
                    }
                    onDelete={(url) => handleDelete(url.short_code)}
                    onEdit={(url) => setEditDialog({ open: true, url })}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateUrlDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          fetchUrls()
          setCreateDialogOpen(false)
        }}
      />

      <EditUrlDialog
        open={editDialog.open}
        url={editDialog.url}
        onOpenChange={(open: boolean) =>
          setEditDialog({ open, url: undefined })
        }
        onSuccess={() => {
          fetchUrls()
          setEditDialog({ open: false })
        }}
      />
    </div>
  )
}
