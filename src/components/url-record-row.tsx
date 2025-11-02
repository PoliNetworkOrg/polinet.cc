import { Copy, Edit, ExternalLink, Trash2 } from "lucide-react"
import type { UrlRecord } from "@/lib/schemas"
import { Button } from "./ui/button"
import { TableCell, TableRow } from "./ui/table"

export type UrlRecordRowProps = {
  url: UrlRecord
  onCopy: (url: UrlRecord) => void
  onDelete: (url: UrlRecord) => void
  onEdit: (url: UrlRecord) => void
}

export function UrlRecordRow({ url, ...props }: UrlRecordRowProps) {
  return (
    <TableRow key={url.id}>
      <TableCell>
        <div className="flex items-center gap-2">
          <a
            href={`https://polinet.cc/${url.short_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-mono"
          >
            polinet.cc/{url.short_code}
          </a>
          <Button variant="ghost" size="sm" onClick={() => props.onCopy(url)}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[300px]">{url.original_url}</span>
          <a href={url.original_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </a>
        </div>
      </TableCell>
      <TableCell>
        <span className="font-medium">{url.click_count}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {url.created_at.toLocaleString()}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => props.onEdit(url)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => props.onDelete(url)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
