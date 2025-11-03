"use client"

import { Search, Star } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { useDebounce } from "use-debounce"
import logo from "@/assets/logo.png"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useUrls } from "@/hooks/urls"
import type { UrlRecord, UrlsQueryParams } from "@/lib/schemas"
import { copyToClipboard } from "@/lib/utils"
import { CreateUrlDialog } from "./create-url-dialog"
import { EditUrlDialog } from "./edit-url-dialog"
import { PaginationControls } from "./pagination"
import { Toggle } from "./ui/toggle"
import { UrlRecordRow } from "./url-record-row"

export function Dashboard() {
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch] = useDebounce(searchInput, 300)
  const [qp, setQueryParams] = useState<UrlsQueryParams>({
    page: 1,
    limit: 10,
    sortBy: "created_at",
    sortOrder: "desc",
  })
  // Merge debounced search with query params
  const queryParams: UrlsQueryParams = {
    ...qp,
    search: debouncedSearch || undefined,
  }

  const { urls, pagination, loading, refetch } = useUrls(queryParams)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    url?: UrlRecord
  }>({ open: false })

  const handleCustomOnlyToggle = () => {
    setQueryParams((prev) => ({
      ...prev,
      customOnly: !prev.customOnly,
      page: 1,
    }))
  }

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split("-") as [
      UrlsQueryParams["sortBy"],
      UrlsQueryParams["sortOrder"],
    ]
    setQueryParams((prev) => ({
      ...prev,
      sortBy,
      sortOrder,
    }))
  }

  const handlePageChange = (page: number) => {
    setQueryParams((prev) => ({ ...prev, page }))
  }
  const handleLimitChange = (limit: number) => {
    setQueryParams((prev) => ({ ...prev, limit, page: 1 }))
  }

  const handleDelete = async (shortCode: string) => {
    if (!confirm("Are you sure you want to delete this URL?")) return

    try {
      const response = await fetch(`/api/urls/${shortCode}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("URL deleted successfully")
        refetch()
      } else {
        toast.error("Failed to delete URL")
      }
    } catch (error) {
      console.error("Error deleting URL:", error)
      toast.error("Failed to delete URL")
    }
  }

  const currentSort = `${qp.sortBy}-${qp.sortOrder}`

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex gap-4 items-center">
        <Image src={logo} alt="PoliNetwork Logo" className="h-16 w-16" />
        <div className="mr-auto gap-2">
          <h1 className="text-3xl font-bold">polinet.cc</h1>
          <p className="text-muted-foreground">
            PoliNetwork's URL shortener dashboard
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/api">
            <Button variant="outline">API Docs</Button>
          </Link>
          <Button onClick={() => setCreateDialogOpen(true)}>
            Create Short URL
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your URLs</CardTitle>
          <CardDescription>
            All your shortened URLs and their statistics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search URLs or short codes..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={currentSort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">Newest First</SelectItem>
                <SelectItem value="created_at-asc">Oldest First</SelectItem>
                <SelectItem value="updated_at-desc">
                  Recently Updated
                </SelectItem>
                <SelectItem value="click_count-desc">Most Clicks</SelectItem>
                <SelectItem value="click_count-asc">Least Clicks</SelectItem>
                <SelectItem value="short_code-asc">Short Code A-Z</SelectItem>
                <SelectItem value="short_code-desc">Short Code Z-A</SelectItem>
              </SelectContent>
            </Select>
            <Toggle
              pressed={queryParams.customOnly}
              onPressedChange={handleCustomOnlyToggle}
              className="data-[state=on]:bg-secondary data-[state=on]:*:[svg]:fill-yellow-300 data-[state=on]:*:[svg]:stroke-yellow-300"
            >
              <Star className="h-4 w-4" />
              Show Custom Only
            </Toggle>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-6">Loading...</div>
          ) : urls.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              {searchInput
                ? "No URLs found matching your search."
                : "No URLs found. Create your first short URL to get started."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-4">
                      <Star className="h-4 w-4" />
                    </TableHead>
                    <TableHead>Short URL</TableHead>
                    <TableHead>Original URL</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-0 text-center">Clicks</TableHead>
                    <TableHead className="w-0 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {urls.map((url: UrlRecord) => (
                    <UrlRecordRow
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

              {/* Pagination */}
              {pagination && (
                <PaginationControls
                  {...pagination}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateUrlDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          refetch()
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
          refetch()
          setEditDialog({ open: false })
        }}
      />
    </div>
  )
}
