"use client"

import { Copy, Edit, ExternalLink, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreateUrlDialog } from "./create-url-dialog"
import { EditUrlDialog } from "./edit-url-dialog"

interface UrlRecord {
  id: string
  original_url: string
  short_code: string
  created_at: string
  updated_at: string
  click_count: number
}

export function Dashboard() {
  const [urls, setUrls] = useState<UrlRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    url?: UrlRecord
  }>({ open: false })

  const fetchUrls = useCallback(async () => {
    try {
      const response = await fetch("/api/urls")
      if (response.ok) {
        const data = await response.json()
        setUrls(data)
      } else {
        toast.error("Failed to fetch URLs")
      }
    } catch (error) {
      console.error("Error fetching URLs:", error)
      toast.error("Failed to fetch URLs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUrls()
  }, [fetchUrls])

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
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
                  <TableRow key={url.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://pnet.work/${url.short_code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-mono"
                        >
                          pnet.work/{url.short_code}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              `https://pnet.work/${url.short_code}`
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[300px]">
                          {url.original_url}
                        </span>
                        <a
                          href={url.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{url.click_count}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(url.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditDialog({ open: true, url })}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(url.short_code)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
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
